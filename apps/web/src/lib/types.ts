export type TaskType = "gradescope_submit" | "code_edit_test" | "raw";

export type TaskState =
  | "queued"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "denied";

export type LogLevel = "info" | "step" | "action" | "warn" | "error";

export interface LogEntry {
  timestamp: string; // ISO string
  level: LogLevel;
  message: string;
}

export interface ApprovalContext {
  action: string;       // Short label: "Click Final Submit"
  description: string;  // Full context shown to user
  risk: "low" | "medium" | "high";
}

export interface GradescopeParams {
  courseName: string;
  assignmentName: string;
  filePath: string;
}

export interface CodeEditParams {
  repoPath: string;
  filePath: string;
  editRequest: string;
  testCommand: string;
}

export interface Task {
  id: string;
  type: TaskType;
  userPrompt: string;
  params: GradescopeParams | CodeEditParams | Record<string, string>;
  visualAgent?: boolean;
  state: TaskState;
  logs: LogEntry[];
  approvalContext?: ApprovalContext;
  result?: string;
  createdAt: string;
  updatedAt: string;
}

// Payloads sent over SSE to the frontend
export type SSEEvent =
  | { type: "snapshot"; task: Task }
  | { type: "log"; taskId: string; entry: LogEntry }
  | { type: "state"; taskId: string; state: TaskState }
  | { type: "approval"; taskId: string; context: ApprovalContext }
  | { type: "complete"; taskId: string; result: string }
  | { type: "error"; taskId: string; message: string };
