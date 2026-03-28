import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import type { Task, TaskType } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, userPrompt, params, visualAgent } = body as {
    type: TaskType;
    userPrompt: string;
    params: Record<string, string>;
    visualAgent?: boolean;
  };

  if (!userPrompt?.trim()) {
    return NextResponse.json({ error: "userPrompt is required" }, { status: 400 });
  }

  const task: Task = {
    id: crypto.randomUUID(),
    type: type || "raw",
    userPrompt,
    params: params || {},
    visualAgent: !!visualAgent,
    state: "queued",
    logs: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.createTask(task);
  return NextResponse.json(task, { status: 201 });
}

export async function GET() {
  const tasks = store.getAllTasks();
  return NextResponse.json(tasks);
}
