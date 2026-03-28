import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Frontend polls this for the latest screen frame
export async function GET() {
  if (!store.screenEnabled || !store.latestFrame) {
    return NextResponse.json({ frame: null, ts: null });
  }
  return NextResponse.json({
    frame: store.latestFrame,
    ts: store.frameTimestamp,
  });
}
