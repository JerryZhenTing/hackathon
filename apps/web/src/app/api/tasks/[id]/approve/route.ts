import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ok = store.resolveApproval(params.id, true);
  if (!ok) {
    return NextResponse.json(
      { error: "Task not found or not waiting for approval" },
      { status: 400 }
    );
  }
  return NextResponse.json({ approved: true });
}
