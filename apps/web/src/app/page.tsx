"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  AppShell,
  Badge,
  Button,
  Group,
  Stack,
  Text,
  Textarea,
  TextInput,
  Paper,
  Box,
  Modal,
  Alert,
  Code,
  Flex,
  Tabs,
  ActionIcon,
  Divider,
  CloseButton,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { Task, TaskType, LogEntry } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuickAction {
  id?: string; // present on custom actions
  label: string;
  type: TaskType;
  prompt: string;
  fields: { key: string; label: string; placeholder: string }[];
}

interface ActiveFormState {
  action: QuickAction;
  isClarification: boolean;
  originalPrompt?: string;
}

const BUILT_IN_ACTIONS: QuickAction[] = [
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

// ─── Clarification logic ──────────────────────────────────────────────────────

function suggestClarification(prompt: string): QuickAction | null {
  const lower = prompt.toLowerCase().trim();
  const words = lower.split(/\s+/).filter(Boolean);

  if (
    lower.includes("gradescope") ||
    (lower.includes("submit") &&
      (lower.includes("assignment") ||
        lower.includes("homework") ||
        /hw\d/i.test(lower)))
  ) {
    return BUILT_IN_ACTIONS[0];
  }

  if (
    (lower.includes("edit") ||
      lower.includes("fix") ||
      lower.includes("change") ||
      lower.includes("refactor") ||
      lower.includes("debug")) &&
    (lower.includes("code") ||
      lower.includes("file") ||
      lower.includes("bug") ||
      /\.(py|js|ts|tsx|jsx|java|go|rs|cpp|c)\b/.test(lower))
  ) {
    return BUILT_IN_ACTIONS[1];
  }

  if (words.length < 5) {
    return {
      label: "Clarify your request",
      type: "raw",
      prompt,
      fields: [
        {
          key: "details",
          label: "What exactly should happen?",
          placeholder: "Be specific — what app, file, or website is involved?",
        },
        {
          key: "context",
          label: "Additional context (optional)",
          placeholder: "File paths, URLs, credentials location…",
        },
      ],
    };
  }

  return null;
}

// ─── Log helpers ──────────────────────────────────────────────────────────────

function logColor(level: LogEntry["level"]) {
  switch (level) {
    case "info":   return "#71717a";
    case "step":   return "#38bdf8";
    case "action": return "#a78bfa";
    case "warn":   return "#fbbf24";
    case "error":  return "#f87171";
    default:       return "#71717a";
  }
}

function logPrefix(level: LogEntry["level"]) {
  switch (level) {
    case "info":   return "INFO ";
    case "step":   return "STEP ";
    case "action": return "ACT  ";
    case "warn":   return "WARN ";
    case "error":  return "ERR  ";
    default:       return "     ";
  }
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ state }: { state: Task["state"] }) {
  const map: Record<Task["state"], { color: string; label: string }> = {
    queued:           { color: "gray",   label: "Queued" },
    running:          { color: "blue",   label: "Running" },
    waiting_approval: { color: "yellow", label: "Approval" },
    completed:        { color: "green",  label: "Done" },
    failed:           { color: "red",    label: "Failed" },
    denied:           { color: "orange", label: "Denied" },
  };
  const { color, label } = map[state];
  return (
    <Badge color={color} variant="dot" size="sm" tt="none" fw={500}>
      {label}
    </Badge>
  );
}

// ─── InlineActionForm ─────────────────────────────────────────────────────────

function InlineActionForm({
  form,
  submitting,
  onSubmit,
  onBack,
  onSkip,
}: {
  form: ActiveFormState;
  submitting: boolean;
  onSubmit: (prompt: string, type: TaskType, params: Record<string, string>) => void;
  onBack: () => void;
  onSkip?: () => void;
}) {
  const { action, isClarification, originalPrompt } = form;
  const [params, setParams] = useState<Record<string, string>>({});

  const handleSubmit = () => {
    if (isClarification) {
      const extras = Object.entries(params)
        .filter(([, v]) => v.trim())
        .map(([k, v]) => `${k}: ${v}`)
        .join("; ");
      const full = extras ? `${originalPrompt}\n\n${extras}` : originalPrompt!;
      onSubmit(full, "raw", params);
    } else {
      const promptStr = `${action.prompt}: ${Object.entries(params)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")}`;
      onSubmit(promptStr, action.type, params);
    }
  };

  const inputStyles = {
    label: {
      color: "var(--mantine-color-dark-2)",
      fontSize: "0.73rem",
      marginBottom: 4,
      fontWeight: 500,
      letterSpacing: "0.02em",
    },
    input: {
      background: "var(--mantine-color-dark-9)",
      border: "1px solid var(--mantine-color-dark-5)",
      color: "var(--mantine-color-gray-1)",
      fontFamily: "var(--mantine-font-family-monospace)",
      fontSize: "0.8rem",
    },
  };

  return (
    <Stack gap="sm">
      {/* Form header */}
      <Group justify="space-between" align="center">
        <Button
          variant="subtle"
          size="xs"
          c="dimmed"
          leftSection={<span style={{ fontSize: 10 }}>←</span>}
          onClick={onBack}
          styles={{ root: { padding: "0 6px", height: 24 } }}
        >
          Back
        </Button>
        <Group gap="xs">
          {isClarification && (
            <Badge color="yellow" variant="light" size="sm" tt="none">
              Needs more info
            </Badge>
          )}
          <Text size="xs" c="gray.3" fw={500}>
            {action.label}
          </Text>
        </Group>
      </Group>

      <Divider color="dark.6" />

      {/* Fields */}
      {action.fields.map((f) => (
        <TextInput
          key={f.key}
          label={f.label}
          placeholder={f.placeholder}
          size="sm"
          value={params[f.key] || ""}
          onChange={(e) => setParams((p) => ({ ...p, [f.key]: e.target.value }))}
          styles={inputStyles}
        />
      ))}

      {/* Actions */}
      <Group justify="flex-end" gap="xs" mt={4}>
        {onSkip && (
          <Button
            variant="subtle"
            size="sm"
            c="dimmed"
            onClick={onSkip}
            styles={{ root: { fontSize: "0.75rem" } }}
          >
            Run as-is
          </Button>
        )}
        <Button
          size="sm"
          fw={600}
          loading={submitting}
          onClick={handleSubmit}
          rightSection={<span style={{ fontSize: "0.7rem", opacity: 0.6 }}>⌘↵</span>}
          styles={{ root: { paddingRight: 10 } }}
        >
          Run Task
        </Button>
      </Group>
    </Stack>
  );
}

// ─── AddActionModal ───────────────────────────────────────────────────────────

function AddActionModal({
  opened,
  onClose,
  onAdd,
}: {
  opened: boolean;
  onClose: () => void;
  onAdd: (action: QuickAction) => void;
}) {
  const [label, setLabel] = useState("");
  const [fields, setFields] = useState([{ label: "", placeholder: "" }]);

  const reset = () => {
    setLabel("");
    setFields([{ label: "", placeholder: "" }]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const updateField = (i: number, key: "label" | "placeholder", val: string) =>
    setFields((prev) => prev.map((f, j) => (j === i ? { ...f, [key]: val } : f)));

  const handleSave = () => {
    if (!label.trim()) return;
    onAdd({
      id: `custom-${Date.now()}`,
      label: label.trim(),
      type: "raw",
      prompt: label.trim(),
      fields: fields
        .filter((f) => f.label.trim())
        .map((f) => ({
          key: f.label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
          label: f.label.trim(),
          placeholder: f.placeholder.trim(),
        })),
    });
    handleClose();
  };

  const inputStyles = {
    label: { color: "var(--mantine-color-dark-2)", fontSize: "0.73rem", marginBottom: 3 },
    input: {
      background: "var(--mantine-color-dark-9)",
      border: "1px solid var(--mantine-color-dark-5)",
      color: "var(--mantine-color-gray-1)",
      fontSize: "0.82rem",
    },
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={<Text size="sm" fw={600} c="gray.1">New Quick Action</Text>}
      size="sm"
      overlayProps={{ backgroundOpacity: 0.65, blur: 4 }}
      styles={{
        content: {
          background: "var(--mantine-color-dark-8)",
          border: "1px solid var(--mantine-color-dark-5)",
        },
        header: { background: "var(--mantine-color-dark-8)", paddingBottom: 8 },
      }}
    >
      <Stack gap="sm">
        <TextInput
          label="Action name"
          placeholder="e.g. Send Email, Run Script…"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          size="sm"
          styles={inputStyles}
        />

        <Box>
          <Text size="xs" c="dimmed" fw={500} tt="uppercase" mb="xs" style={{ letterSpacing: "0.06em" }}>
            Fields
          </Text>
          <Stack gap={6}>
            {fields.map((f, i) => (
              <Group key={i} gap={6} align="flex-end" wrap="nowrap">
                <TextInput
                  label={i === 0 ? "Field label" : undefined}
                  placeholder="e.g. File path"
                  flex={1}
                  size="xs"
                  value={f.label}
                  onChange={(e) => updateField(i, "label", e.target.value)}
                  styles={inputStyles}
                />
                <TextInput
                  label={i === 0 ? "Placeholder" : undefined}
                  placeholder="e.g. /home/user/…"
                  flex={1}
                  size="xs"
                  value={f.placeholder}
                  onChange={(e) => updateField(i, "placeholder", e.target.value)}
                  styles={inputStyles}
                />
                {fields.length > 1 && (
                  <CloseButton
                    size="sm"
                    mb={i === 0 ? 0 : undefined}
                    onClick={() => setFields((prev) => prev.filter((_, j) => j !== i))}
                    style={{ flexShrink: 0, color: "var(--mantine-color-dark-3)" }}
                  />
                )}
              </Group>
            ))}
          </Stack>
          <Button
            variant="subtle"
            size="xs"
            c="dimmed"
            mt="xs"
            onClick={() => setFields((prev) => [...prev, { label: "", placeholder: "" }])}
          >
            + Add field
          </Button>
        </Box>

        <Divider color="dark.6" />

        <Group justify="flex-end" gap="xs">
          <Button variant="subtle" size="sm" c="dimmed" onClick={handleClose}>
            Cancel
          </Button>
          <Button size="sm" fw={600} disabled={!label.trim()} onClick={handleSave}>
            Save Action
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ─── ApprovalModal ────────────────────────────────────────────────────────────

function ApprovalModal({
  task,
  opened,
  onApprove,
  onDeny,
}: {
  task: Task | null;
  opened: boolean;
  onApprove: () => void;
  onDeny: () => void;
}) {
  if (!task?.approvalContext) return null;
  const ctx = task.approvalContext;
  const riskColor = { low: "blue", medium: "yellow", high: "red" }[ctx.risk];

  return (
    <Modal
      opened={opened}
      onClose={onDeny}
      title={
        <Group gap="xs">
          <Text size="sm" fw={600} c="gray.1">Approval Required</Text>
          <Badge color={riskColor} size="xs" variant="filled" tt="none">
            {ctx.risk} risk
          </Badge>
        </Group>
      }
      size="sm"
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={false}
      overlayProps={{ backgroundOpacity: 0.7, blur: 6 }}
      styles={{
        content: {
          background: "var(--mantine-color-dark-8)",
          border: "1px solid var(--mantine-color-dark-5)",
        },
        header: { background: "var(--mantine-color-dark-8)", paddingBottom: 8 },
      }}
    >
      <Stack gap="md">
        <Box>
          <Text size="xs" c="dimmed" mb={6} fw={500} tt="uppercase" style={{ letterSpacing: "0.06em" }}>
            Action
          </Text>
          <Code
            block
            style={{
              background: "var(--mantine-color-dark-9)",
              border: "1px solid var(--mantine-color-dark-6)",
              fontSize: "0.78rem",
              color: "var(--mantine-color-gray-2)",
            }}
          >
            {ctx.action}
          </Code>
        </Box>
        <Text size="sm" c="dimmed" lh={1.6}>{ctx.description}</Text>
        <Group grow mt={4}>
          <Button color="green" size="sm" fw={600} onClick={onApprove}>Approve</Button>
          <Button color="red" variant="outline" size="sm" fw={600} onClick={onDeny}>Deny</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ─── LogViewer ────────────────────────────────────────────────────────────────

function LogViewer({ logs }: { logs: LogEntry[] }) {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  return (
    <Box
      style={{
        background: "#050507",
        borderRadius: 8,
        border: "1px solid #1c1c20",
        height: 216,
        overflowY: "auto",
        padding: "10px 12px",
        fontFamily: "var(--mantine-font-family-monospace)",
        fontSize: "0.71rem",
        lineHeight: 1.65,
      }}
    >
      {logs.length === 0 ? (
        <Text size="xs" c="dark.4" style={{ fontFamily: "inherit" }}>
          Waiting for execution to start…
        </Text>
      ) : (
        logs.map((entry, i) => (
          <div
            key={i}
            className="log-entry"
            style={{ display: "flex", gap: 10, marginBottom: 1 }}
          >
            <span style={{ color: "#3f3f46", flexShrink: 0, userSelect: "none" }}>
              {new Date(entry.timestamp).toLocaleTimeString("en", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
            <span style={{ color: "#52525b", flexShrink: 0, userSelect: "none" }}>
              {logPrefix(entry.level)}
            </span>
            <span style={{ color: logColor(entry.level), wordBreak: "break-all" }}>
              {entry.message}
            </span>
          </div>
        ))
      )}
      <div ref={logEndRef} />
    </Box>
  );
}

// ─── ActiveTaskPanel ──────────────────────────────────────────────────────────

function ActiveTaskPanel({
  task,
  onOpenApproval,
  onKill,
}: {
  task: Task;
  onOpenApproval: () => void;
  onKill: () => void;
}) {
  const hasResult =
    (task.state === "completed" || task.state === "failed" || task.state === "denied") &&
    task.result;

  return (
    <Paper
      p="md"
      radius="md"
      style={{
        background: "rgba(24, 24, 27, 0.9)",
        border: "1px solid #27272a",
        boxShadow: "0 0 0 1px rgba(56,189,248,0.05), 0 8px 32px rgba(0,0,0,0.4)",
        backdropFilter: "blur(12px)",
      }}
    >
      <Group justify="space-between" mb="sm" align="flex-start" wrap="nowrap">
        <Box style={{ minWidth: 0, flex: 1 }}>
          <Text
            size="xs"
            c="dimmed"
            tt="uppercase"
            fw={500}
            mb={2}
            style={{ letterSpacing: "0.06em" }}
          >
            {task.type.replace(/_/g, " ")}
          </Text>
          <Text
            size="sm"
            c="gray.2"
            style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {task.userPrompt}
          </Text>
        </Box>
        <Group gap="xs" style={{ flexShrink: 0 }}>
          <StatusBadge state={task.state} />
          {task.state === "waiting_approval" && (
            <Button size="xs" color="yellow" variant="filled" fw={600} onClick={onOpenApproval}>
              Review
            </Button>
          )}
          {(task.state === "running" || task.state === "queued" || task.state === "waiting_approval") && (
            <Tooltip label="Abort agent" withArrow position="top">
              <Button
                size="xs"
                onClick={onKill}
                styles={{
                  root: {
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 10,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    height: 24,
                    padding: "0 10px",
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    color: "#f87171",
                    "&:hover": { background: "rgba(239,68,68,0.2)" },
                  },
                }}
              >
                Kill
              </Button>
            </Tooltip>
          )}
        </Group>
      </Group>

      {hasResult ? (
        <Tabs defaultValue="logs" variant="pills">
          <Tabs.List mb="sm" style={{ gap: 4 }}>
            <Tabs.Tab value="logs">Logs</Tabs.Tab>
            <Tabs.Tab value="result">Result</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="logs">
            <LogViewer logs={task.logs} />
          </Tabs.Panel>
          <Tabs.Panel value="result">
            <Box
              style={{
                background: task.state === "completed" ? "#0c1a12" : "#1a0c0c",
                borderRadius: 8,
                border: `1px solid ${task.state === "completed" ? "#163826" : "#381616"}`,
                padding: "10px 12px",
                maxHeight: 216,
                overflowY: "auto",
              }}
            >
              <Text
                size="xs"
                style={{
                  color: task.state === "completed" ? "#4ade80" : "#f87171",
                  fontFamily: "var(--mantine-font-family-monospace)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  lineHeight: 1.65,
                }}
              >
                {task.result}
              </Text>
            </Box>
          </Tabs.Panel>
        </Tabs>
      ) : (
        <LogViewer logs={task.logs} />
      )}
    </Paper>
  );
}

// ─── TaskHistoryList ──────────────────────────────────────────────────────────

function TaskHistoryList({
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
    <Box>
      <Text
        size="xs"
        c="dimmed"
        tt="uppercase"
        fw={500}
        mb="xs"
        style={{ letterSpacing: "0.1em", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10 }}
      >
        History
      </Text>
      <Paper
        radius="md"
        style={{
          background: "rgba(24, 24, 27, 0.9)",
          border: "1px solid #27272a",
          boxShadow: "0 0 0 1px rgba(56,189,248,0.05), 0 8px 32px rgba(0,0,0,0.4)",
          backdropFilter: "blur(12px)",
          overflow: "hidden",
        }}
      >
        {tasks.map((t, i) => (
          <Box
            key={t.id}
            onClick={() => onSelect(t.id)}
            style={{
              padding: "10px 14px",
              cursor: "pointer",
              background: t.id === activeId ? "var(--mantine-color-dark-7)" : "transparent",
              borderBottom:
                i < tasks.length - 1 ? "1px solid var(--mantine-color-dark-7)" : undefined,
              transition: "background 0.1s ease",
            }}
            onMouseEnter={(e) => {
              if (t.id !== activeId)
                (e.currentTarget as HTMLDivElement).style.background =
                  "rgba(39,39,42,0.5)";
            }}
            onMouseLeave={(e) => {
              if (t.id !== activeId)
                (e.currentTarget as HTMLDivElement).style.background = "transparent";
            }}
          >
            <Group justify="space-between" wrap="nowrap">
              <Text
                size="xs"
                c="gray.3"
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                }}
              >
                {t.userPrompt}
              </Text>
              <StatusBadge state={t.state} />
            </Group>
            <Text size="xs" c="dimmed" mt={2} style={{ fontSize: "0.68rem" }}>
              {new Date(t.createdAt).toLocaleTimeString()}
            </Text>
          </Box>
        ))}
      </Paper>
    </Box>
  );
}

// ─── ScreenMonitor ────────────────────────────────────────────────────────────

function ScreenMonitor() {
  const [enabled, setEnabled] = useState(false);
  const [frame, setFrame] = useState<string | null>(null);
  const [lastTs, setLastTs] = useState<number | null>(null);
  const [toggling, setToggling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPolling = () => {
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch("/api/screen/frame");
        const d = await r.json();
        if (d.frame) { setFrame(d.frame); setLastTs(d.ts); }
      } catch {}
    }, 500);
  };

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const toggle = async () => {
    setToggling(true);
    try {
      const next = !enabled;
      await fetch("/api/screen/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      setEnabled(next);
      if (next) { startPolling(); } else { stopPolling(); setFrame(null); setLastTs(null); }
    } finally {
      setToggling(false);
    }
  };

  useEffect(() => () => stopPolling(), []);

  const fps = lastTs ? `${((Date.now() - lastTs) / 1000).toFixed(1)}s ago` : null;

  return (
    <Paper
      p="md"
      radius="md"
      style={{
        background: "rgba(24, 24, 27, 0.9)",
        border: enabled ? "1px solid rgba(56,189,248,0.25)" : "1px solid #27272a",
        boxShadow: enabled
          ? "0 0 0 1px rgba(56,189,248,0.08), 0 0 24px rgba(56,189,248,0.06), 0 8px 32px rgba(0,0,0,0.4)"
          : "0 0 0 1px rgba(56,189,248,0.04), 0 8px 32px rgba(0,0,0,0.4)",
        backdropFilter: "blur(12px)",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
      }}
    >
      {/* Header row */}
      <Group justify="space-between" align="center" mb={enabled ? "sm" : 0}>
        <Group gap="sm" align="center">
          <Box
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: enabled ? "rgba(56,189,248,0.12)" : "rgba(39,39,42,0.8)",
              border: enabled ? "1px solid rgba(56,189,248,0.25)" : "1px solid #3f3f46",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s ease",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={enabled ? "#38bdf8" : "#71717a"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          </Box>
          <Box>
            <Text
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: enabled ? "#f4f4f5" : "#71717a",
                transition: "color 0.2s ease",
              }}
            >
              Screen Monitor
            </Text>
            {enabled && lastTs && (
              <Text style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#52525b", letterSpacing: "0.05em" }}>
                LIVE · updated {fps}
              </Text>
            )}
          </Box>
        </Group>

        <Button
          size="xs"
          loading={toggling}
          onClick={toggle}
          styles={{
            root: {
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              height: 28,
              paddingLeft: 12,
              paddingRight: 12,
              background: enabled
                ? "rgba(239,68,68,0.12)"
                : "linear-gradient(135deg, #0ea5e9, #38bdf8)",
              border: enabled ? "1px solid rgba(239,68,68,0.3)" : "none",
              color: enabled ? "#f87171" : "#fff",
              transition: "all 0.2s ease",
            },
          }}
        >
          {enabled ? "Stop" : "Start"}
        </Button>
      </Group>

      {/* Live frame */}
      {enabled && (
        <Box
          style={{
            borderRadius: 6,
            overflow: "hidden",
            border: "1px solid rgba(56,189,248,0.12)",
            background: "#050507",
            aspectRatio: "16/9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {frame ? (
            <img
              src={`data:image/jpeg;base64,${frame}`}
              alt="Live screen"
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          ) : (
            <Stack align="center" gap={6}>
              <Box style={{ position: "relative", width: 20, height: 20 }}>
                <Box style={{
                  width: 20, height: 20, borderRadius: "50%",
                  border: "2px solid #27272a",
                  borderTopColor: "#38bdf8",
                  animation: "spin 0.8s linear infinite",
                }} />
              </Box>
              <Text style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#52525b", letterSpacing: "0.08em" }}>
                Waiting for bridge…
              </Text>
            </Stack>
          )}
          {/* Live indicator */}
          {frame && (
            <Box style={{
              position: "absolute", top: 8, right: 8,
              display: "flex", alignItems: "center", gap: 5,
              background: "rgba(9,9,11,0.75)", borderRadius: 4,
              padding: "3px 7px", backdropFilter: "blur(4px)",
            }}>
              <Box style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "#22c55e",
                boxShadow: "0 0 5px rgba(34,197,94,0.6)",
                animation: "pulse-live 2s ease-in-out infinite",
              }} />
              <Text style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#71717a", letterSpacing: "0.08em" }}>LIVE</Text>
            </Box>
          )}
        </Box>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-live {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.85); }
        }
      `}</style>
    </Paper>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "remotely-custom-actions";

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [bridgeOnline, setBridgeOnline] = useState(false);
  const [freeText, setFreeText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Inline form state (examples + clarification)
  const [activeForm, setActiveForm] = useState<ActiveFormState | null>(null);

  // Custom actions (persisted)
  const [customActions, setCustomActions] = useState<QuickAction[]>([]);

  // Modals
  const [approvalOpen, { open: openApproval, close: closeApproval }] = useDisclosure(false);
  const [addActionOpen, { open: openAddAction, close: closeAddAction }] = useDisclosure(false);

  const activeTask = tasks.find((t) => t.id === activeTaskId) ?? null;
  const allExamples = [...BUILT_IN_ACTIONS, ...customActions];

  // ── Load custom actions from localStorage ─────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCustomActions(JSON.parse(saved));
    } catch {}
  }, []);

  const saveCustomActions = (actions: QuickAction[]) => {
    setCustomActions(actions);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
    } catch {}
  };

  const handleAddAction = (action: QuickAction) => {
    saveCustomActions([...customActions, action]);
  };

  const handleDeleteAction = (id: string) => {
    saveCustomActions(customActions.filter((a) => a.id !== id));
  };

  // ── State-transition effects ──────────────────────────────────────────────
  const prevActiveRef = useRef<Task | null>(null);

  useEffect(() => {
    const prev = prevActiveRef.current;
    prevActiveRef.current = activeTask;
    if (!activeTask) return;

    const prevState = prev?.id === activeTask.id ? prev.state : null;

    if (activeTask.state === "waiting_approval" && prevState !== "waiting_approval") {
      openApproval();
    }
    if (activeTask.state !== "waiting_approval" && prevState === "waiting_approval") {
      closeApproval();
    }
    if (activeTask.state === "completed" && prevState === "running") {
      notifications.show({
        title: "Task completed",
        message: activeTask.userPrompt.slice(0, 80),
        color: "green",
        autoClose: 4000,
      });
    }
    if (activeTask.state === "failed" && prevState === "running") {
      notifications.show({
        title: "Task failed",
        message: activeTask.result?.slice(0, 80) || "Something went wrong",
        color: "red",
        autoClose: 5000,
      });
    }
  }, [activeTask?.state, activeTask?.id]); // eslint-disable-line

  // ── Bridge heartbeat ──────────────────────────────────────────────────────
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

  // ── Initial task list ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then(setTasks)
      .catch(() => {});
  }, []);

  // ── SSE stream for active task ────────────────────────────────────────────
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

  // ── Submit ────────────────────────────────────────────────────────────────
  const submitTask = useCallback(
    async (
      prompt: string,
      type: TaskType = "raw",
      params: Record<string, string> = {}
    ) => {
      setSubmitting(true);
      setActiveForm(null);
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

  // ── Run button handler: clarify or submit directly ────────────────────────
  const handleRun = () => {
    const text = freeText.trim();
    if (!text) return;
    const clarification = suggestClarification(text);
    if (clarification) {
      setActiveForm({
        action: { ...clarification, prompt: text },
        isClarification: true,
        originalPrompt: text,
      });
    } else {
      submitTask(text);
    }
  };

  // ── Kill ──────────────────────────────────────────────────────────────────
  const handleKill = useCallback(async () => {
    if (!activeTaskId) return;
    await fetch(`/api/tasks/${activeTaskId}/kill`, { method: "POST" });
    closeApproval();
  }, [activeTaskId]); // eslint-disable-line

  // ── Approve / Deny ────────────────────────────────────────────────────────
  const handleApprove = useCallback(async () => {
    if (!activeTaskId) return;
    await fetch(`/api/tasks/${activeTaskId}/approve`, { method: "POST" });
    closeApproval();
  }, [activeTaskId]); // eslint-disable-line

  const handleDeny = useCallback(async () => {
    if (!activeTaskId) return;
    await fetch(`/api/tasks/${activeTaskId}/deny`, { method: "POST" });
    closeApproval();
  }, [activeTaskId]); // eslint-disable-line

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=DM+Sans:wght@300;400;500&display=swap');

        .page-dot-grid {
          position: fixed;
          inset: 0;
          background-image: radial-gradient(circle, #27272a 1px, transparent 1px);
          background-size: 28px 28px;
          opacity: 0.55;
          pointer-events: none;
          z-index: 0;
        }
        .page-glow {
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 320px;
          background: radial-gradient(ellipse 80% 60% at 50% -10%, rgba(56, 189, 248, 0.07) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }
        .header-wordmark {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #f4f4f5;
        }
        .header-cursor {
          display: inline-block;
          width: 2px;
          height: 0.9em;
          background: #38bdf8;
          margin-left: 2px;
          vertical-align: middle;
          border-radius: 1px;
          animation: blink-cursor 1.1s step-end infinite;
          box-shadow: 0 0 5px rgba(56, 189, 248, 0.7);
        }
        @keyframes blink-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .mono-label {
          font-family: 'IBM Plex Mono', monospace !important;
          font-size: 10px !important;
          font-weight: 500 !important;
          letter-spacing: 0.1em !important;
          text-transform: uppercase !important;
          color: #71717a !important;
        }
      `}</style>

      <div className="page-dot-grid" />
      <div className="page-glow" />

    <AppShell
      header={{ height: 52 }}
      styles={{
        root: { background: "#09090b" },
        header: {
          background: "rgba(9, 9, 11, 0.92)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(56,189,248,0.07)",
          boxShadow: "0 1px 0 #1c1c20",
        },
        main: { background: "transparent", paddingTop: "calc(52px + 24px)", position: "relative", zIndex: 1 },
      }}
    >
      {/* ── Header ── */}
      <AppShell.Header style={{ zIndex: 10 }}>
        <Flex align="center" justify="space-between" h="100%" px="lg">
          <span className="header-wordmark">
            Remotely<span className="header-cursor" />
          </span>
          <Badge
            color={bridgeOnline ? "green" : "gray"}
            variant="dot"
            size="sm"
            tt="none"
            fw={500}
            style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.06em" }}
          >
            {bridgeOnline ? "Connected" : "Offline"}
          </Badge>
        </Flex>
      </AppShell.Header>

      {/* ── Main ── */}
      <AppShell.Main>
        <Box maw={680} mx="auto" px="md" pb="xl">
          <Stack gap="md">

            {/* ── Input / Form Card ── */}
            <Paper
              p="md"
              radius="md"
              style={{
                background: "rgba(24, 24, 27, 0.9)",
                border: "1px solid #27272a",
                boxShadow: "0 0 0 1px rgba(56,189,248,0.05), 0 8px 32px rgba(0,0,0,0.4)",
                backdropFilter: "blur(12px)",
              }}
            >
              {activeForm ? (
                /* ── Inline form (example or clarification) ── */
                <InlineActionForm
                  form={activeForm}
                  submitting={submitting}
                  onSubmit={submitTask}
                  onBack={() => setActiveForm(null)}
                  onSkip={
                    activeForm.isClarification
                      ? () => submitTask(activeForm.originalPrompt!)
                      : undefined
                  }
                />
              ) : (
                /* ── Default input view ── */
                <Stack gap="sm">
                  <Textarea
                    placeholder='What should your laptop do?  e.g. "Submit my CS101 HW3 on Gradescope"'
                    autosize
                    minRows={2}
                    maxRows={6}
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && freeText.trim()) {
                        handleRun();
                      }
                    }}
                    styles={{
                      input: {
                        background: "var(--mantine-color-dark-9)",
                        border: "1px solid var(--mantine-color-dark-5)",
                        color: "var(--mantine-color-gray-1)",
                        fontSize: "0.875rem",
                        lineHeight: 1.6,
                        resize: "none",
                      },
                    }}
                  />

                  {/* Examples row */}
                  <Box>
                    <Group gap={6} align="center">
                      <Text
                        size="xs"
                        c="dimmed"
                        fw={500}
                        style={{ letterSpacing: "0.1em", flexShrink: 0, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, textTransform: "uppercase" }}
                      >
                        Examples:
                      </Text>
                      {allExamples.map((a) => (
                        <Group
                          key={a.id ?? a.type}
                          gap={0}
                          style={{ position: "relative" }}
                        >
                          <Button
                            size="xs"
                            variant="default"
                            onClick={() =>
                              setActiveForm({ action: a, isClarification: false })
                            }
                            styles={{
                              root: {
                                background: "var(--mantine-color-dark-7)",
                                border: "1px solid var(--mantine-color-dark-5)",
                                color: "var(--mantine-color-dark-1)",
                                fontSize: "0.72rem",
                                height: 26,
                                padding: "0 10px",
                                borderRadius: a.id
                                  ? "var(--mantine-radius-md) 0 0 var(--mantine-radius-md)"
                                  : undefined,
                                borderRight: a.id ? "none" : undefined,
                              },
                            }}
                          >
                            {a.label}
                          </Button>
                          {a.id && (
                            <Tooltip label="Remove" withArrow position="top">
                              <ActionIcon
                                size={26}
                                variant="default"
                                onClick={() => handleDeleteAction(a.id!)}
                                styles={{
                                  root: {
                                    background: "var(--mantine-color-dark-7)",
                                    border: "1px solid var(--mantine-color-dark-5)",
                                    borderLeft: "1px solid var(--mantine-color-dark-5)",
                                    borderRadius:
                                      "0 var(--mantine-radius-md) var(--mantine-radius-md) 0",
                                    color: "var(--mantine-color-dark-3)",
                                    "&:hover": {
                                      color: "var(--mantine-color-red-4)",
                                    },
                                  },
                                }}
                              >
                                <span style={{ fontSize: 9 }}>✕</span>
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Group>
                      ))}

                      {/* Add custom action */}
                      <Tooltip label="Add example" withArrow position="top">
                        <ActionIcon
                          size={26}
                          variant="default"
                          onClick={openAddAction}
                          styles={{
                            root: {
                              background: "transparent",
                              border: "1px dashed var(--mantine-color-dark-5)",
                              color: "var(--mantine-color-dark-3)",
                            },
                          }}
                        >
                          <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Box>

                  {/* Submit */}
                  <Group justify="flex-end">
                    <Button
                      size="sm"
                      fw={500}
                      loading={submitting}
                      disabled={!freeText.trim() || submitting}
                      onClick={handleRun}
                      rightSection={
                        <Text
                          size="xs"
                          style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            opacity: 0.6,
                            color: "#bae6fd",
                          }}
                        >
                          ⌘↵
                        </Text>
                      }
                      styles={{
                        root: {
                          paddingLeft: 16,
                          paddingRight: 10,
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: 11,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          background: "linear-gradient(135deg, #0ea5e9, #38bdf8)",
                          border: "none",
                          "&:hover": { boxShadow: "0 0 16px rgba(56,189,248,0.3)" },
                        },
                      }}
                    >
                      Run
                    </Button>
                  </Group>
                </Stack>
              )}
            </Paper>

            {/* Offline warning */}
            {!bridgeOnline && (
              <Alert
                color="yellow"
                variant="light"
                styles={{
                  root: {
                    background: "rgba(202, 138, 4, 0.08)",
                    border: "1px solid rgba(202, 138, 4, 0.2)",
                  },
                  message: { color: "var(--mantine-color-yellow-4)", fontSize: "0.8rem" },
                }}
              >
                Laptop agent is offline. Start{" "}
                <Code
                  style={{
                    background: "var(--mantine-color-dark-7)",
                    color: "var(--mantine-color-gray-3)",
                    fontSize: "0.75rem",
                  }}
                >
                  services/agent-bridge/bridge.py
                </Code>{" "}
                on your laptop to connect.
              </Alert>
            )}

            {/* Screen monitor */}
            <ScreenMonitor />

            {/* Active task */}
            {activeTask && (
              <ActiveTaskPanel task={activeTask} onOpenApproval={openApproval} onKill={handleKill} />
            )}

            {/* History */}
            <TaskHistoryList
              tasks={tasks}
              activeId={activeTaskId}
              onSelect={setActiveTaskId}
            />
          </Stack>
        </Box>
      </AppShell.Main>

      {/* ── Modals ── */}
      <ApprovalModal
        task={activeTask}
        opened={approvalOpen}
        onApprove={handleApprove}
        onDeny={handleDeny}
      />
      <AddActionModal
        opened={addActionOpen}
        onClose={closeAddAction}
        onAdd={handleAddAction}
      />
    </AppShell>
    </>
  );
}
