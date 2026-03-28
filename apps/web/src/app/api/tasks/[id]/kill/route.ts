import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ok = store.killTask(params.id);
  if (!ok) return NextResponse.json({ ok: false, reason: "task not killable" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
