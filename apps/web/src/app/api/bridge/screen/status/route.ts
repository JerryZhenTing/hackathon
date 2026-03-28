import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export const runtime = "nodejs";

// Bridge polls this to know whether to capture and send frames
export async function GET() {
  return NextResponse.json({ enabled: store.screenEnabled });
}
