import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const task = store.getNextQueued();
  if (!task) return NextResponse.json(null);
  // Mark as running immediately so it won't be claimed twice
  store.updateState(task.id, "running");
  return NextResponse.json(task);
}
