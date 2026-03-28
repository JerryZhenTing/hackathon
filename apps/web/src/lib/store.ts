import { EventEmitter } from "events";
import type { Task, LogEntry, TaskState, ApprovalContext } from "./types";

class TaskStore extends EventEmitter {
  private tasks = new Map<string, Task>();
  private lastHeartbeat: number = 0;
  // Pending user messages for the running agent (one at a time)
  private pendingMessages = new Map<string, string>();
  // Screen streaming
  screenEnabled: boolean = false;
  latestFrame: string | null = null;
  frameTimestamp: number = 0;

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  getAllTasks(): Task[] {
    return (Array.from(this.tasks.values()) as Task[]).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  createTask(task: Task): Task {
    this.tasks.set(task.id, task);
    this.emit("taskCreated", task);
    return task;
  }

  updateState(id: string, state: TaskState): Task | null {
    const task = this.tasks.get(id);
    if (!task) return null;
    task.state = state;
    task.updatedAt = new Date().toISOString();
    this.emit("taskUpdated", task);
    return task;
  }

  addLog(id: string, entry: LogEntry): Task | null {
    const task = this.tasks.get(id);
    if (!task) return null;
    task.logs.push(entry);
    task.updatedAt = new Date().toISOString();
    this.emit("taskUpdated", task);
    this.emit("taskLog", id, entry);
    return task;
  }

  setApprovalContext(id: string, context: ApprovalContext): Task | null {
    const task = this.tasks.get(id);
    if (!task) return null;
    task.approvalContext = context;
    task.state = "waiting_approval";
    task.updatedAt = new Date().toISOString();
    this.emit("taskUpdated", task);
    this.emit("approvalRequested", id, context);
    return task;
  }

  resolveApproval(id: string, approved: boolean): boolean {
    const task = this.tasks.get(id);
    if (!task || task.state !== "waiting_approval") return false;
    task.approvalContext = undefined;
    task.state = approved ? "running" : "denied";
    task.updatedAt = new Date().toISOString();
    this.emit("taskUpdated", task);
    this.emit("approvalResolved", id, approved);
    return true;
  }

  completeTask(id: string, result: string): Task | null {
    const task = this.tasks.get(id);
    if (!task) return null;
    task.state = "completed";
    task.result = result;
    task.updatedAt = new Date().toISOString();
    this.emit("taskUpdated", task);
    return task;
  }

  failTask(id: string, message: string): Task | null {
    const task = this.tasks.get(id);
    if (!task) return null;
    task.state = "failed";
    task.result = message;
    task.updatedAt = new Date().toISOString();
    this.emit("taskUpdated", task);
    return task;
  }

  addUserMessage(id: string, message: string) {
    this.pendingMessages.set(id, message);
    this.emit("userMessage", id, message);
  }

  // Returns and clears the pending message (bridge calls this)
  consumeUserMessage(id: string): string | null {
    const msg = this.pendingMessages.get(id) ?? null;
    this.pendingMessages.delete(id);
    return msg;
  }

  // Get the next queued task (for bridge polling)
  getNextQueued(): Task | null {
    const values = Array.from(this.tasks.values());
    return values.find((t) => t.state === "queued") ?? null;
  }

  recordHeartbeat() {
    this.lastHeartbeat = Date.now();
    this.emit("bridgeOnline");
  }

  isBridgeOnline(): boolean {
    // Consider bridge online if heartbeat within last 10 seconds
    return Date.now() - this.lastHeartbeat < 10_000;
  }

  setScreenEnabled(enabled: boolean) {
    this.screenEnabled = enabled;
    if (!enabled) this.latestFrame = null;
    this.emit("screenToggled", enabled);
  }

  setFrame(base64: string) {
    this.latestFrame = base64;
    this.frameTimestamp = Date.now();
    this.emit("newFrame");
  }
}

// Singleton: survives Next.js hot reloads in dev
const globalStore = global as typeof globalThis & { taskStore?: TaskStore };
if (!globalStore.taskStore) {
  globalStore.taskStore = new TaskStore();
  globalStore.taskStore.setMaxListeners(100);
}

export const store = globalStore.taskStore;
