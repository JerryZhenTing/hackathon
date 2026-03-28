import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export const runtime = "nodejs";

// Bridge polls this between agent iterations to inject user messages
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const message = store.consumeUserMessage(params.id);
  return NextResponse.json({ message });
}
