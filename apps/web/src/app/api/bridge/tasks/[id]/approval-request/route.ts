import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import type { ApprovalContext } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const context = (await req.json()) as ApprovalContext;
  const task = store.setApprovalContext(params.id, context);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, state: task.state });
}
