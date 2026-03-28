import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export const runtime = "nodejs";

// Bridge polls this to know if it should abort a running task
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const kill = store.checkAndClearKill(params.id);
  return NextResponse.json({ kill });
}
