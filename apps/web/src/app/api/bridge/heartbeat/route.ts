import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export const runtime = "nodejs";

export async function POST() {
  store.recordHeartbeat();
  return NextResponse.json({ ok: true, ts: Date.now() });
}

export async function GET() {
  return NextResponse.json({ online: store.isBridgeOnline() });
}
