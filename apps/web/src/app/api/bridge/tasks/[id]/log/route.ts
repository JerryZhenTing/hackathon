import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import type { LogLevel } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { level, message } = (await req.json()) as {
    level: LogLevel;
    message: string;
  };

  const entry = {
    timestamp: new Date().toISOString(),
    level: level || "info",
    message,
  };

  const task = store.addLog(params.id, entry);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
