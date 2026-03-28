"""
Gradescope submission workflow.

Flow:
1. Open browser to gradescope.com
2. Navigate to the specified course
3. Find the specified assignment
4. Upload the file
5. REQUEST APPROVAL before clicking final Submit
6. Click submit only after approval
"""

import os
import time
import logging

log = logging.getLogger("gradescope")


def run_gradescope_submit(
    task_id: str,
    params: dict,
    log_fn,
    approval_fn,
    complete_fn,
    fail_fn,
    executor,
):
    course = params.get("courseName", "")
    assignment = params.get("assignmentName", "")
    file_path = params.get("filePath", "")

    if not all([course, assignment, file_path]):
        fail_fn(task_id, "Missing required params: courseName, assignmentName, filePath")
        return

    if not os.path.exists(file_path):
        fail_fn(task_id, f"File not found: {file_path}")
        return

    log_fn(task_id, "step", f"Starting Gradescope submission")
    log_fn(task_id, "info", f"Course: {course}")
    log_fn(task_id, "info", f"Assignment: {assignment}")
    log_fn(task_id, "info", f"File: {file_path}")

    # Check if we're using mock executor
    from executor import MockExecutor
    if isinstance(executor, MockExecutor):
        _run_mock(task_id, course, assignment, file_path, log_fn, approval_fn, complete_fn, fail_fn)
    else:
        _run_real(task_id, course, assignment, file_path, log_fn, approval_fn, complete_fn, fail_fn, executor)


def _run_mock(task_id, course, assignment, file_path, log_fn, approval_fn, complete_fn, fail_fn):
    """Mock execution — simulates the full workflow with delays."""
    steps = [
        ("step",   "Opening browser..."),
        ("step",   "Navigating to gradescope.com"),
        ("info",   "Checking login status..."),
        ("step",   "Logged in — loading dashboard"),
        ("step",   f"Searching for course: {course}"),
        ("info",   f"Found course: {course}"),
        ("step",   f"Looking for assignment: {assignment}"),
        ("info",   f"Assignment found — status: Active"),
        ("step",   "Opening submission dialog"),
        ("action", f"Uploading file: {file_path}"),
        ("info",   "File upload complete — ready to submit"),
    ]

    for level, msg in steps:
        log_fn(task_id, level, msg)
        time.sleep(0.7)

    # The critical approval gate
    approved = approval_fn(
        task_id,
        f"Click Final Submit",
        (
            f"About to click the final Submit button on Gradescope.\n\n"
            f"Course: {course}\n"
            f"Assignment: {assignment}\n"
            f"File: {file_path}\n\n"
            "This action cannot be undone."
        ),
        "high",
    )

    if not approved:
        fail_fn(task_id, f"Submission cancelled by user before final submit.")
        return

    log_fn(task_id, "action", "Clicking Submit button...")
    time.sleep(1.0)
    log_fn(task_id, "step", "Submission confirmed — waiting for confirmation page...")
    time.sleep(0.8)
    log_fn(task_id, "step", "Submission successful!")

    complete_fn(
        task_id,
        f"Successfully submitted {file_path} for {assignment} in {course}.\nSubmitted at {time.strftime('%H:%M:%S')}.",
    )


def _run_real(task_id, course, assignment, file_path, log_fn, approval_fn, complete_fn, fail_fn, executor):
    """Real execution using Claude computer use."""
    with open(os.path.join(os.path.dirname(__file__), "../prompts/gradescope.md")) as f:
        system_prompt = f.read()

    user_message = f"""
Submit an assignment on Gradescope with these exact details:

- Course: {course}
- Assignment: {assignment}
- File to upload: {file_path}

Follow the system instructions exactly. Do not submit until you receive explicit approval.
"""

    try:
        result = executor._run_agentic_loop(
            task_id=task_id,
            system_prompt=system_prompt,
            user_message=user_message,
            log_fn=log_fn,
            approval_fn=approval_fn,
            api_fn=executor._api_fn,
            use_computer=True,
        )
        complete_fn(task_id, result)
    except Exception as e:
        fail_fn(task_id, f"Gradescope workflow failed: {e}")
