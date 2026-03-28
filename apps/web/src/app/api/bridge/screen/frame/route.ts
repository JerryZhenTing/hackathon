import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export const runtime = "nodejs";

// Bridge posts a screen frame here as base64 JPEG
export async function POST(req: NextRequest) {
  if (!store.screenEnabled) {
    return NextResponse.json({ ok: false, reason: "screen streaming disabled" });
  }
  const { frame } = await req.json();
  if (!frame) return NextResponse.json({ ok: false, reason: "no frame" }, { status: 400 });
  store.setFrame(frame);
  return NextResponse.json({ ok: true });
}
