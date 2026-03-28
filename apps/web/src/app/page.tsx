"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Task, TaskType, LogEntry } from "@/lib/types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface QuickAction {
  label: string;
  type: TaskType;
  prompt: string;
  fields: { key: string; label: string; placeholder: string }[];
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Submit Gradescope",
    type: "gradescope_submit",
    prompt: "Submit my assignment on Gradescope",
    fields: [
      { key: "courseName", label: "Course", placeholder: "CS 101" },
      { key: "assignmentName", label: "Assignment", placeholder: "Homework 3" },
      { key: "filePath", label: "File path", placeholder: "/home/jerry/hw3.py" },
    ],
  },
  {
    label: "Edit Code & Test",
    type: "code_edit_test",
    prompt: "Edit my code and run tests",
    fields: [
      { key: "repoPath", label: "Repo path", placeholder: "/home/jerry/myproject" },
      { key: "filePath", label: "File", placeholder: "src/main.py" },
      { key: "editRequest", label: "What to change", placeholder: "Fix the off-by-one error in parse_csv()" },
      { key: "testCommand", label: "Test command", placeholder: "pytest tests/" },
    ],
  },
];

// ─── Log level styling ────────────────────────────────────────────────────────

function logStyle(level: LogEntry["level"]) {
  switch (level) {
    case "info":    return "text-zinc-400";
    case "step":    return "text-sky-400";
    case "action":  return "text-violet-400";
    case "warn":    return "text-amber-400";
    case "error":   return "text-red-400";
    default:        return "text-zinc-400";
  }
}

function logPrefix(level: LogEntry["level"]) {
  switch (level) {
    case "info":    return "INFO  ";
    case "step":    return "STEP  ";
    case "action":  return "ACT   ";
    case "warn":    return "WARN  ";
    case "error":   return "ERROR ";
    default:        return "      ";
  }
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ state }: { state: Task["state"] }) {
  const configs: Record<Task["state"], { dot: string; text: string; label: string }> = {
    queued:           { dot: "bg-zinc-500",  text: "text-zinc-400",  label: "Queued" },
    running:          { dot: "bg-sky-500 animate-pulse", text: "text-sky-400", label: "Running" },
    waiting_approval: { dot: "bg-amber-500 animate-pulse", text: "text-amber-400", label: "Needs Approval" },
    completed:        { dot: "bg-green-500", text: "text-green-400", label: "Completed" },
    failed:           { dot: "bg-red-500",   text: "text-red-400",   label: "Failed" },
    denied:           { dot: "bg-red-400",   text: "text-red-300",   label: "Denied" },
  };
  const c = configs[state];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

// ─── Active Task Panel ─────────────────────────────────────────────────────────

function ActiveTaskPanel({
  task,
  onApprove,
  onDeny,
  onSendMessage,
}: {
  task: Task;
  onApprove: () => void;
  onDeny: () => void;
  onSendMessage: (msg: string) => void;
}) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const [reply, setReply] = useState("");

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [task.logs.length]);

  const submitReply = () => {
    if (!reply.trim()) return;
    onSendMessage(reply.trim());
    setReply("");
  };

  return (
    <div className={`rounded-xl border bg-zinc-900 p-4 ${
      task.state === "waiting_approval" ? "border-amber-600" : "border-zinc-800"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-xs text-zinc-500 uppercase tracking-wider">
            {task.type.replace(/_/g, " ")}
          </span>
          <p className="text-sm text-zinc-200 mt-0.5 line-clamp-1">{task.userPrompt}</p>
        </div>
        <StatusBadge state={task.state} />
      </div>

      {/* Live log */}
      <div className="bg-zinc-950 rounded-lg p-3 h-56 overflow-y-auto text-xs font-mono border border-zinc-800">
        {task.logs.length === 0 ? (
          <p className="text-zinc-600">Waiting for execution to start...</p>
        ) : (
          task.logs.map((entry, i) => (
            <div key={i} className={`log-entry flex gap-2 mb-0.5 ${logStyle(entry.level)}`}>
              <span className="text-zinc-600 shrink-0 select-none">
                {new Date(entry.timestamp).toLocaleTimeString("en", {
                  hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
                })}
              </span>
              <span className="text-zinc-500 shrink-0 select-none">{logPrefix(entry.level)}</span>
              <span className="break-all">{entry.message}</span>
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>

      {/* Result */}
      {(task.state === "completed" || task.state === "failed" || task.state === "denied") && task.result && (
        <div className={`mt-3 rounded-lg border p-3 text-xs ${
          task.state === "completed"
            ? "border-green-800 bg-green-950 text-green-300"
            : "border-red-800 bg-red-950 text-red-300"
        }`}>
          <p className="font-semibold mb-1">
            {task.state === "completed" ? "Result" : task.state === "denied" ? "Denied" : "Error"}
          </p>
          <pre className="whitespace-pre-wrap break-words font-mono">{task.result}</pre>
        </div>
      )}

      {/* Approval — inline, always visible, no fixed positioning */}
      {task.state === "waiting_approval" && task.approvalContext && (
        <div className="mt-3 rounded-xl border-2 border-amber-500 bg-amber-950/40 p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-amber-400">⚠</span>
            <span className="text-sm font-bold text-amber-300">Approval Required</span>
          </div>
          <p className="text-xs font-mono text-amber-200 mb-1">{task.approvalContext.action}</p>
          <p className="text-xs text-zinc-400 mb-3 leading-relaxed">{task.approvalContext.description}</p>
          <div className="flex gap-3">
            <button onClick={onApprove}
              className="flex-1 py-3 text-sm font-bold rounded-xl bg-green-600 hover:bg-green-500 active:bg-green-700 text-white transition-colors">
              Approve
            </button>
            <button onClick={onDeny}
              className="flex-1 py-3 text-sm font-bold rounded-xl bg-red-700 hover:bg-red-600 active:bg-red-800 text-white transition-colors">
              Deny
            </button>
          </div>
        </div>
      )}

      {/* Reply input — hidden during approval (use buttons only), shown otherwise */}
      {task.state !== "denied" && task.state !== "waiting_approval" && (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            placeholder={task.state === "running" ? "Reply to agent..." : "New task..."}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitReply()}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-sky-600"
          />
          <button onClick={submitReply} disabled={!reply.trim()}
            className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-sky-700 hover:bg-sky-600 disabled:opacity-40 text-white transition-colors">
            {task.state === "running" ? "Send" : "Run"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Task History ─────────────────────────────────────────────────────────────

function TaskHistory({
  tasks,
  activeId,
  onSelect,
}: {
  tasks: Task[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  if (tasks.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">History</p>
      <div className="space-y-1">
        {tasks.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
              t.id === activeId
                ? "bg-zinc-700 text-zinc-100"
                : "hover:bg-zinc-800 text-zinc-400"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">{t.userPrompt}</span>
              <StatusBadge state={t.state} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Quick Action Form ─────────────────────────────────────────────────────────

function QuickActionForm({
  action,
  onSubmit,
  onCancel,
}: {
  action: QuickAction;
  onSubmit: (prompt: string, type: TaskType, params: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [params, setParams] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = `${action.prompt}: ${Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}`;
    onSubmit(prompt, action.type, params);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">
        {action.label}
      </p>
      {action.fields.map((f) => (
        <div key={f.key}>
          <label className="block text-xs text-zinc-500 mb-1">{f.label}</label>
          <input
            type="text"
            placeholder={f.placeholder}
            value={params[f.key] || ""}
            onChange={(e) =>
              setParams((p) => ({ ...p, [f.key]: e.target.value }))
            }
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600/30"
          />
        </div>
      ))}
      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 py-2 text-sm font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors"
        >
          Run Task
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [bridgeOnline, setBridgeOnline] = useState(false);
  const [freeText, setFreeText] = useState("");
  const [selectedAction, setSelectedAction] = useState<QuickAction | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const activeTask = tasks.find((t) => t.id === activeTaskId) ?? null;

  // ── Poll bridge status ───────────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch("/api/bridge/heartbeat");
        const d = await r.json();
        setBridgeOnline(d.online);
      } catch {
        setBridgeOnline(false);
      }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  // ── Load initial task list ───────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then(setTasks)
      .catch(() => {});
  }, []);

  // ── Stream updates for the active task ──────────────────────────────────────
  useEffect(() => {
    if (!activeTaskId) return;

    const es = new EventSource(`/api/tasks/${activeTaskId}/stream`);

    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "snapshot") {
        const updated: Task = data.task;
        setTasks((prev) =>
          prev.some((t) => t.id === updated.id)
            ? prev.map((t) => (t.id === updated.id ? updated : t))
            : [updated, ...prev]
        );
      }
    };

    es.onerror = () => es.close();

    return () => es.close();
  }, [activeTaskId]);

  // ── Submit task ──────────────────────────────────────────────────────────────
  const submitTask = useCallback(
    async (
      prompt: string,
      type: TaskType = "raw",
      params: Record<string, string> = {}
    ) => {
      setSubmitting(true);
      setSelectedAction(null);
      try {
        const r = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userPrompt: prompt, type, params }),
        });
        const task: Task = await r.json();
        setTasks((prev) => [task, ...prev]);
        setActiveTaskId(task.id);
        setFreeText("");
      } finally {
        setSubmitting(false);
      }
    },
    []
  );

  // ── Approve / Deny ───────────────────────────────────────────────────────────
  const handleApprove = useCallback(async (id: string) => {
    await fetch(`/api/tasks/${id}/approve`, { method: "POST" });
  }, []);

  const handleDeny = useCallback(async (id: string) => {
    await fetch(`/api/tasks/${id}/deny`, { method: "POST" });
  }, []);

  // ── Send message to running agent ────────────────────────────────────────────
  const handleSendMessage = useCallback(async (id: string, message: string) => {
    await fetch(`/api/tasks/${id}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* ── Header ── */}
      <header className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-zinc-100 tracking-tight">
            Remotely
          </span>
          <span className="text-xs text-zinc-600 hidden sm:block">
            laptop control
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              bridgeOnline ? "bg-green-500 animate-pulse" : "bg-zinc-600"
            }`}
          />
          <span className={bridgeOnline ? "text-green-400" : "text-zinc-500"}>
            {bridgeOnline ? "Laptop connected" : "Laptop offline"}
          </span>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 space-y-4">
        {/* Task Input Card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          {selectedAction ? (
            <QuickActionForm
              action={selectedAction}
              onSubmit={submitTask}
              onCancel={() => setSelectedAction(null)}
            />
          ) : (
            <div className="space-y-3">
              <textarea
                rows={3}
                placeholder="Type a command for your laptop... e.g. 'Submit my CS101 HW3 on Gradescope'"
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    if (freeText.trim()) submitTask(freeText.trim());
                  }
                }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600/30 resize-none"
              />

              {/* Quick action buttons */}
              <div className="flex flex-wrap gap-2">
                {QUICK_ACTIONS.map((a) => (
                  <button
                    key={a.type}
                    onClick={() => setSelectedAction(a)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                  >
                    {a.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => freeText.trim() && submitTask(freeText.trim())}
                disabled={!freeText.trim() || submitting}
                className="w-full py-2 text-sm font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
              >
                {submitting ? "Submitting..." : "Run on Laptop  ⌘↵"}
              </button>
            </div>
          )}
        </div>

        {/* Offline warning */}
        {!bridgeOnline && (
          <div className="rounded-lg border border-amber-800 bg-amber-950/50 px-4 py-3 text-xs text-amber-300">
            Laptop agent is offline. Start{" "}
            <code className="bg-zinc-800 px-1 rounded">services/agent-bridge/bridge.py</code>{" "}
            on your laptop to connect.
          </div>
        )}

        {/* Active task */}
        {activeTask && (
          <ActiveTaskPanel
            task={activeTask}
            onApprove={() => handleApprove(activeTask.id)}
            onDeny={() => handleDeny(activeTask.id)}
            onSendMessage={(msg) => {
              const active = ["running", "waiting_approval"].includes(activeTask.state);
              if (active) {
                handleSendMessage(activeTask.id, msg);
              } else {
                // Task is done — submit as a new task, prepend prior context summary
                const context = activeTask.result
                  ? `Previous task result: ${activeTask.result.slice(0, 300)}\n\nFollow-up: ${msg}`
                  : msg;
                submitTask(context);
              }
            }}
          />
        )}

        {/* Task history */}
        <TaskHistory
          tasks={tasks}
          activeId={activeTaskId}
          onSelect={setActiveTaskId}
        />
      </main>
    </div>
  );
}
