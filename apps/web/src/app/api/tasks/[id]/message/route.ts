import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export const runtime = "nodejs";

// User sends a text message to the running agent
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { message } = (await req.json()) as { message: string };
  if (!message?.trim()) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }
  const task = store.getTask(params.id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!["running", "waiting_approval"].includes(task.state)) {
    return NextResponse.json({ error: "Task is not active" }, { status: 400 });
  }
  store.addUserMessage(params.id, message.trim());
  // Log it so the user sees it in the stream
  store.addLog(params.id, {
    timestamp: new Date().toISOString(),
    level: "info",
    message: `[You] ${message.trim()}`,
  });
  return NextResponse.json({ ok: true });
}
