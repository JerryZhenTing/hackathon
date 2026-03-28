"""
executor.py — Two executor implementations:

MockExecutor: Simulates task execution with realistic delays.
              Great for demo without real API keys.

RealExecutor: Uses Anthropic's Claude API with computer_use,
              bash, and text_editor tools (the OpenClaw equivalent).
"""

import os
import time
import json
import subprocess
import logging
from typing import Callable, Optional

log = logging.getLogger("executor")

LogFn = Callable[[str, str, str], None]           # (task_id, level, message)
ApprovalFn = Callable[[str, str, str, str], bool] # (task_id, action, description, risk) -> bool
ApiFn = Callable[..., Optional[dict]]             # bridge's api() helper


# ─── Mock Executor ────────────────────────────────────────────────────────────

class MockExecutor:
    """
    Simulates execution for demo/testing purposes.
    Returns canned results with realistic step delays.
    """

    def run_browser(self, task_id: str, steps: list[str], log_fn: LogFn) -> str:
        for step in steps:
            log_fn(task_id, "step", step)
            time.sleep(0.8)
        return "Mock browser task completed."

    def run_shell(self, task_id: str, command: str, log_fn: LogFn) -> str:
        log_fn(task_id, "action", f"$ {command}")
        time.sleep(1.0)
        # Actually run the command for real shell tasks (safe ones)
        try:
            result = subprocess.run(
                command, shell=True, capture_output=True, text=True, timeout=30
            )
            output = result.stdout + result.stderr
            log_fn(task_id, "info", output.strip() or "(no output)")
            return output
        except Exception as e:
            log_fn(task_id, "error", str(e))
            return str(e)

    def run_raw(self, task_id: str, prompt: str, log_fn: LogFn, approval_fn: ApprovalFn) -> str:
        log_fn(task_id, "info", f"[MOCK] Processing: {prompt}")
        time.sleep(1.5)
        log_fn(task_id, "step", "Analyzing request...")
        time.sleep(1.0)
        log_fn(task_id, "step", "Executing task...")
        time.sleep(1.5)
        return f"[MOCK] Task complete: {prompt}"


# ─── Real Executor ────────────────────────────────────────────────────────────

class RealExecutor:
    """
    Uses Anthropic Claude with computer_use, bash, and text_editor tools.
    This is the OpenClaw-equivalent execution layer.
    """

    def __init__(self):
        import anthropic
        self.client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        self.model = os.getenv("CLAUDE_MODEL", "claude-3-5-sonnet-20241022")

    def _run_agentic_loop(
        self,
        task_id: str,
        system_prompt: str,
        user_message: str,
        log_fn: LogFn,
        approval_fn: ApprovalFn,
        api_fn: Optional[ApiFn] = None,
        max_iterations: int = 30,
        use_computer: bool = False,
        visual_agent: bool = False,
    ) -> str:
        """
        Core agentic loop: sends messages to Claude, handles tool calls,
        streams logs back to the frontend.

        use_computer=False: bash + text_editor only (works with claude-sonnet-4-6)
        use_computer=True:  adds computer tool for browser/GUI (needs claude-3-7-sonnet-20250219)
        """
        import anthropic

        messages = [{"role": "user", "content": user_message}]

        tools = [
            {
                "type": "bash_20250124",
                "name": "bash",
            },
            {
                "type": "text_editor_20250728",
                "name": "str_replace_based_edit_tool",
            },
        ]

        betas = ["computer-use-2025-01-24"]

        if use_computer:
            tools.insert(0, {
                "type": "computer_20250124",
                "name": "computer",
                "display_width_px": 1920,
                "display_height_px": 1080,
                "display_number": 1,
            })

        final_result = ""

        for iteration in range(max_iterations):
            # Check if the user sent a message from the UI to inject into the conversation
            if api_fn:
                pending = api_fn("GET", f"/api/bridge/tasks/{task_id}/user-message")
                if pending and pending.get("message"):
                    user_msg = pending["message"]
                    log_fn(task_id, "info", f"Injecting user message: {user_msg}")
                    messages.append({"role": "user", "content": user_msg})

            log_fn(task_id, "info", f"Agent iteration {iteration + 1}...")

            response = self.client.beta.messages.create(
                model=self.model,
                max_tokens=4096,
                system=system_prompt,
                tools=tools,  # type: ignore
                messages=messages,
                betas=betas,
            )

            # Collect assistant content
            assistant_content = []

            for block in response.content:
                if block.type == "text":
                    if block.text:
                        log_fn(task_id, "info", f"Agent: {block.text[:200]}")
                        final_result = block.text
                    assistant_content.append({"type": "text", "text": block.text})

                elif block.type == "tool_use":
                    tool_name = block.name
                    tool_input = block.input
                    log_fn(task_id, "action", f"Tool: {tool_name} — {json.dumps(tool_input)[:120]}")
                    assistant_content.append({
                        "type": "tool_use",
                        "id": block.id,
                        "name": tool_name,
                        "input": tool_input,
                    })

            messages.append({"role": "assistant", "content": assistant_content})

            # Check stop reason
            if response.stop_reason == "end_turn":
                log_fn(task_id, "step", "Agent finished.")
                break

            if response.stop_reason != "tool_use":
                log_fn(task_id, "warn", f"Unexpected stop reason: {response.stop_reason}")
                break

            # Execute tool calls
            tool_results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue

                result = self._execute_tool(
                    task_id=task_id,
                    tool_name=block.name,
                    tool_input=block.input,
                    log_fn=log_fn,
                    approval_fn=approval_fn,
                    visual_agent=visual_agent,
                )

                if result == "__DENIED__":
                    return "Task denied by user before completion."

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result,
                })

            messages.append({"role": "user", "content": tool_results})

        return final_result or "Task completed."

    def _open_path(self, path: str, log_fn: LogFn, task_id: str):
        """Open a file or directory in its default macOS app."""
        expanded = os.path.expanduser(path)
        try:
            result = subprocess.run(["open", expanded], capture_output=True, timeout=5)
            if result.returncode == 0:
                log_fn(task_id, "step", f"Opened {expanded}")
            else:
                log_fn(task_id, "warn", f"open returned {result.returncode}: {result.stderr.decode().strip()}")
        except Exception as e:
            log_fn(task_id, "warn", f"Could not open {expanded}: {e}")

    def _extract_output_paths(self, cmd: str) -> list[str]:
        """Extract output file paths from bash commands (redirects, touch, mkdir, etc.)."""
        import re
        paths = []
        # Redirections: cmd > file, cmd >> file
        for m in re.finditer(r'>{1,2}\s*([^\s|&;]+)', cmd):
            p = m.group(1)
            if p not in ('/dev/null',):
                paths.append(p)
        # touch file
        for m in re.finditer(r'\btouch\s+([^\s|&;]+)', cmd):
            paths.append(m.group(1))
        # mkdir -p dir / mkdir dir
        for m in re.finditer(r'\bmkdir(?:\s+-p)?\s+([^\s|&;]+)', cmd):
            paths.append(m.group(1))
        return paths

    def _execute_tool(
        self,
        task_id: str,
        tool_name: str,
        tool_input: dict,
        log_fn: LogFn,
        approval_fn: ApprovalFn,
        visual_agent: bool = False,
    ) -> str:
        """Execute a single tool call. Returns tool output or '__DENIED__'."""

        if tool_name == "bash":
            cmd = tool_input.get("command", "")

            # Hard block — never execute these regardless of approval
            blocked = any(kw in cmd for kw in ["sudo", "mkfs", "dd ", "> /dev/"])
            if blocked:
                log_fn(task_id, "warn", f"Blocked disallowed command: {cmd[:80]}")
                return f"Error: command not allowed (contains restricted keyword). Do not use sudo or system-level commands."

            # Soft block — ask for approval before running
            dangerous = any(kw in cmd for kw in ["rm -rf", "git push", "git commit"])
            if dangerous:
                approved = approval_fn(
                    task_id,
                    f"Run: {cmd[:60]}",
                    f"About to execute shell command:\n{cmd}",
                    "high",
                )
                if not approved:
                    return "__DENIED__"

            try:
                result = subprocess.run(
                    cmd, shell=True, capture_output=True, text=True, timeout=60
                )
                output = (result.stdout + result.stderr).strip()
                log_fn(task_id, "info", f"$ {cmd[:80]}\n{output[:400]}")
                if visual_agent:
                    for p in self._extract_output_paths(cmd):
                        full = os.path.expanduser(p)
                        if os.path.exists(full):
                            self._open_path(full, log_fn, task_id)
                return output or "(no output)"
            except subprocess.TimeoutExpired:
                return "Command timed out."
            except Exception as e:
                return f"Error: {e}"

        elif tool_name == "str_replace_based_edit_tool":
            command = tool_input.get("command", "")
            path = os.path.expanduser(tool_input.get("path", ""))

            if command == "view":
                try:
                    with open(path) as f:
                        content = f.read()
                    log_fn(task_id, "step", f"Read {path} ({len(content)} chars)")
                    return content
                except Exception as e:
                    return f"Error reading {path}: {e}"

            elif command in ("create", "str_replace"):
                approved = approval_fn(
                    task_id,
                    f"Edit file: {path}",
                    f"About to modify {path} using str_replace_editor ({command})",
                    "medium",
                )
                if not approved:
                    return "__DENIED__"

                try:
                    if command == "create":
                        new_content = tool_input.get("file_text", "")
                        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
                        with open(path, "w") as f:
                            f.write(new_content)
                        log_fn(task_id, "step", f"Created {path}")
                        if visual_agent:
                            self._open_path(path, log_fn, task_id)
                        return f"File created: {path}"
                    else:  # str_replace
                        old_str = tool_input.get("old_str", "")
                        new_str = tool_input.get("new_str", "")
                        with open(path) as f:
                            content = f.read()
                        if old_str not in content:
                            return f"Error: old_str not found in {path}"
                        content = content.replace(old_str, new_str, 1)
                        with open(path, "w") as f:
                            f.write(content)
                        log_fn(task_id, "step", f"Edited {path}")
                        if visual_agent:
                            self._open_path(path, log_fn, task_id)
                        return f"Replaced in {path}"
                except Exception as e:
                    return f"Error editing {path}: {e}"

            return f"Unknown editor command: {command}"

        elif tool_name == "computer":
            # Computer use — screenshot, click, type, key, scroll
            action = tool_input.get("action", "")
            log_fn(task_id, "action", f"computer.{action}")

            try:
                import pyautogui  # type: ignore
                import base64
                from PIL import ImageGrab  # type: ignore

                if action == "screenshot":
                    img = ImageGrab.grab()
                    import io
                    buf = io.BytesIO()
                    img.save(buf, format="PNG")
                    data = base64.b64encode(buf.getvalue()).decode()
                    return [{"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": data}}]

                elif action == "left_click":
                    x, y = tool_input["coordinate"]
                    pyautogui.click(x, y)
                    return f"Clicked ({x}, {y})"

                elif action == "type":
                    pyautogui.typewrite(tool_input.get("text", ""), interval=0.05)
                    return "Typed text"

                elif action == "key":
                    pyautogui.hotkey(*tool_input.get("text", "").split("+"))
                    return "Key pressed"

                elif action == "scroll":
                    x, y = tool_input["coordinate"]
                    pyautogui.scroll(tool_input.get("direction", 0), x=x, y=y)
                    return "Scrolled"

                else:
                    return f"Unknown computer action: {action}"

            except ImportError:
                log_fn(task_id, "warn", "pyautogui/PIL not installed — computer use unavailable")
                return f"[computer use not available on this system — install pyautogui and PIL]"
            except Exception as e:
                return f"Computer use error: {e}"

        return f"Unknown tool: {tool_name}"

    def run_raw(self, task_id: str, prompt: str, log_fn: LogFn, approval_fn: ApprovalFn, api_fn: Optional[ApiFn] = None, visual_agent: bool = False) -> str:
        if visual_agent:
            system = (
                "You are a local laptop agent running in VISUAL mode. "
                "The user can see your screen in real time, so make your actions visible. "
                "When you create or edit a file, use the bash tool to run `open <path>` afterwards so it opens in the default app. "
                "When you need to use an app (browser, terminal, Finder, editor, etc.), open it with `open -a 'AppName'` before interacting with it. "
                "For example: open a folder with `open ~/Documents`, open a URL with `open https://...`, open a Python file with `open file.py`. "
                "Prefer GUI actions that are visible to the user over silent background operations. "
                "Use bash for shell commands and str_replace_based_edit_tool for file edits. "
                "Log each step clearly. Do not take irreversible actions without approval. "
                "NEVER use sudo or any command requiring elevated privileges. "
                "NEVER use interactive commands that wait for input. "
                "Work only within the user's home directory unless told otherwise."
            )
        else:
            system = (
                "You are a local laptop agent. Execute the user's task step by step. "
                "Use bash for shell commands, str_replace_based_edit_tool for file edits. "
                "Log each step clearly. Do not take irreversible actions without approval. "
                "NEVER use sudo or any command requiring elevated privileges. "
                "NEVER use interactive commands that wait for input (apt install -y is fine, but never plain apt install). "
                "Work only within the user's home directory unless told otherwise."
            )
        return self._run_agentic_loop(task_id, system, prompt, log_fn, approval_fn, api_fn=api_fn, visual_agent=visual_agent)
