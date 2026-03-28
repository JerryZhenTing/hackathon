#!/usr/bin/env python3
"""
Remotely Agent Bridge
---------------------
Runs on your laptop. Polls the Next.js backend for queued tasks,
executes them via the executor (real or mock), and streams updates back.
"""

import os
import sys
import time
import logging
import threading
from dotenv import load_dotenv

load_dotenv()

import requests

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000")
USE_MOCK = os.getenv("USE_MOCK", "false").lower() == "true"
POLL_INTERVAL = 2  # seconds between polls

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [bridge] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("bridge")


# ─── HTTP helpers ─────────────────────────────────────────────────────────────

def api(method: str, path: str, **kwargs):
    url = f"{BACKEND_URL}{path}"
    try:
        r = requests.request(method, url, timeout=kwargs.pop("timeout", 30), **kwargs)
        r.raise_for_status()
        return r.json()
    except requests.exceptions.RequestException as e:
        log.error("API call failed: %s %s — %s", method, path, e)
        return None


def post_log(task_id: str, level: str, message: str):
    log.info("[%s] %s: %s", task_id[:8], level.upper(), message)
    api("POST", f"/api/bridge/tasks/{task_id}/log", json={"level": level, "message": message})


def request_approval(task_id: str, action: str, description: str, risk: str = "high") -> bool:
    """
    Send an approval request and block until the user approves or denies.
    Returns True if approved, False if denied or timed out.
    """
    post_log(task_id, "warn", f"Requesting approval: {action}")
    api("POST", f"/api/bridge/tasks/{task_id}/approval-request", json={
        "action": action,
        "description": description,
        "risk": risk,
    })
    # Long-poll: blocks until user responds (up to 10 min)
    result = api("GET", f"/api/bridge/tasks/{task_id}/approval-result", timeout=620)
    if result and result.get("approved"):
        post_log(task_id, "info", "Approval granted — continuing.")
        return True
    else:
        post_log(task_id, "warn", "Approval denied — stopping task.")
        return False


def complete_task(task_id: str, result: str):
    api("POST", f"/api/bridge/tasks/{task_id}/complete", json={"result": result})


def fail_task(task_id: str, message: str):
    api("POST", f"/api/bridge/tasks/{task_id}/fail", json={"message": message})


# ─── Executor selection ───────────────────────────────────────────────────────

def get_executor():
    if USE_MOCK:
        from executor import MockExecutor
        return MockExecutor()
    else:
        from executor import RealExecutor
        return RealExecutor()


# ─── Main loop ────────────────────────────────────────────────────────────────

def run_task_in_thread(task: dict):
    task_id = task["id"]
    task_type = task.get("type", "raw")
    params = task.get("params", {})
    user_prompt = task.get("userPrompt", "")

    log.info("Starting task %s (type=%s)", task_id, task_type)

    try:
        executor = get_executor()

        if task_type == "gradescope_submit":
            from workflows.gradescope import run_gradescope_submit
            run_gradescope_submit(
                task_id=task_id,
                params=params,
                log_fn=post_log,
                approval_fn=request_approval,
                complete_fn=complete_task,
                fail_fn=fail_task,
                executor=executor,
            )
        elif task_type == "code_edit_test":
            from workflows.code_edit import run_code_edit_test
            run_code_edit_test(
                task_id=task_id,
                params=params,
                log_fn=post_log,
                approval_fn=request_approval,
                complete_fn=complete_task,
                fail_fn=fail_task,
                executor=executor,
            )
        else:
            # Raw freeform task — send directly to executor
            post_log(task_id, "info", f"Executing: {user_prompt}")
            result = executor.run_raw(
                task_id=task_id,
                prompt=user_prompt,
                log_fn=post_log,
                approval_fn=request_approval,
            )
            complete_task(task_id, result or "Task completed.")

    except Exception as e:
        log.exception("Task %s failed with exception", task_id)
        fail_task(task_id, f"Execution error: {e}")


def heartbeat_loop():
    while True:
        try:
            api("POST", "/api/bridge/heartbeat")
        except Exception:
            pass
        time.sleep(5)


def main():
    mode = "MOCK" if USE_MOCK else "REAL (Claude API)"
    log.info("Bridge starting — backend=%s mode=%s", BACKEND_URL, mode)

    if not USE_MOCK and not os.getenv("ANTHROPIC_API_KEY"):
        log.error("ANTHROPIC_API_KEY not set. Set USE_MOCK=true or add your key to .env")
        sys.exit(1)

    # Start heartbeat thread
    t = threading.Thread(target=heartbeat_loop, daemon=True)
    t.start()

    log.info("Polling for tasks every %ds...", POLL_INTERVAL)

    while True:
        task = api("GET", "/api/bridge/tasks/pending")
        if task:
            # Run in thread so we can pick up new tasks while one runs
            worker = threading.Thread(target=run_task_in_thread, args=(task,), daemon=True)
            worker.start()
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
