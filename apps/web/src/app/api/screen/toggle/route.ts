import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { enabled } = await req.json();
  store.setScreenEnabled(!!enabled);
  return NextResponse.json({ enabled: store.screenEnabled });
}

export async function GET() {
  return NextResponse.json({ enabled: store.screenEnabled });
}
