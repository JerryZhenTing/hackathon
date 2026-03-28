"""
Code edit + test workflow.

Flow:
1. Read the target file
2. Apply the requested edit using str_replace_editor
3. Run the specified test command
4. Return the test output + a diff summary
5. Approval is requested before saving any file changes
"""

import os
import time
import subprocess
import logging

log = logging.getLogger("code_edit")


def run_code_edit_test(
    task_id: str,
    params: dict,
    log_fn,
    approval_fn,
    complete_fn,
    fail_fn,
    executor,
):
    repo_path = params.get("repoPath", "")
    file_path = params.get("filePath", "")
    edit_request = params.get("editRequest", "")
    test_command = params.get("testCommand", "")

    if not all([file_path, edit_request]):
        fail_fn(task_id, "Missing required params: filePath, editRequest")
        return

    full_path = os.path.join(repo_path, file_path) if repo_path else file_path

    from executor import MockExecutor
    if isinstance(executor, MockExecutor):
        _run_mock(task_id, full_path, file_path, edit_request, test_command, log_fn, approval_fn, complete_fn, fail_fn)
    else:
        _run_real(task_id, repo_path, file_path, edit_request, test_command, log_fn, approval_fn, complete_fn, fail_fn, executor)


def _run_mock(task_id, full_path, file_path, edit_request, test_command, log_fn, approval_fn, complete_fn, fail_fn):
    """Mock code edit + test with simulated delays."""

    log_fn(task_id, "step", f"Reading file: {file_path}")
    time.sleep(0.6)

    # Try to actually read the file if it exists
    file_content = ""
    if os.path.exists(full_path):
        try:
            with open(full_path) as f:
                file_content = f.read()
            log_fn(task_id, "info", f"Read {len(file_content)} chars from {file_path}")
        except Exception as e:
            log_fn(task_id, "warn", f"Could not read file: {e}")
    else:
        log_fn(task_id, "info", f"[MOCK] File would be read from {full_path}")
        time.sleep(0.5)

    log_fn(task_id, "step", f"Analyzing edit request: {edit_request[:60]}")
    time.sleep(1.0)
    log_fn(task_id, "step", "Planning changes...")
    time.sleep(0.8)
    log_fn(task_id, "action", "Applying code changes...")
    time.sleep(1.0)

    diff_summary = f"""--- a/{file_path}
+++ b/{file_path}
@@ -42,7 +42,7 @@
-    for i in range(len(items)):
+    for i in range(len(items) - 1):
     # [MOCK diff — real edit not applied in mock mode]"""

    log_fn(task_id, "info", f"Diff preview:\n{diff_summary}")
    time.sleep(0.5)

    # Approval before saving
    approved = approval_fn(
        task_id,
        f"Save changes to {file_path}",
        (
            f"About to write edited file: {file_path}\n\n"
            f"Change requested: {edit_request}\n\n"
            f"Preview:\n{diff_summary[:300]}"
        ),
        "medium",
    )

    if not approved:
        fail_fn(task_id, "File edit cancelled by user.")
        return

    log_fn(task_id, "action", f"Saving {file_path}...")
    time.sleep(0.5)
    log_fn(task_id, "step", "File saved.")

    # Run tests
    test_output = ""
    if test_command:
        log_fn(task_id, "step", f"Running tests: {test_command}")
        time.sleep(0.5)

        if os.path.exists(full_path):
            try:
                result = subprocess.run(
                    test_command, shell=True, capture_output=True, text=True, timeout=60,
                    cwd=os.path.dirname(full_path),
                )
                test_output = result.stdout + result.stderr
                log_fn(task_id, "info", f"Test output:\n{test_output[:500]}")
            except Exception as e:
                test_output = f"Test error: {e}"
                log_fn(task_id, "error", test_output)
        else:
            test_output = "[MOCK] Tests would run here.\n3 passed, 0 failed."
            log_fn(task_id, "info", test_output)
            time.sleep(1.5)
    else:
        test_output = "No test command provided."

    complete_fn(
        task_id,
        f"Edit applied to {file_path}\n\n"
        f"Change: {edit_request}\n\n"
        f"Diff:\n{diff_summary}\n\n"
        f"Test results:\n{test_output}",
    )


def _run_real(task_id, repo_path, file_path, edit_request, test_command, log_fn, approval_fn, complete_fn, fail_fn, executor):
    """Real execution using Claude with file tools."""
    with open(os.path.join(os.path.dirname(__file__), "../prompts/code_edit.md")) as f:
        system_prompt = f.read()

    full_path = os.path.join(repo_path, file_path) if repo_path else file_path

    user_message = f"""
Make the following code change and run tests:

- File: {full_path}
- Change requested: {edit_request}
- Test command: {test_command or 'none'}
- Repo root: {repo_path or os.path.dirname(full_path)}

Follow the system instructions. Request approval before saving changes.
"""

    try:
        result = executor._run_agentic_loop(
            task_id=task_id,
            system_prompt=system_prompt,
            user_message=user_message,
            log_fn=log_fn,
            approval_fn=approval_fn,
            api_fn=executor._api_fn,
        )
        complete_fn(task_id, result)
    except Exception as e:
        fail_fn(task_id, f"Code edit workflow failed: {e}")
