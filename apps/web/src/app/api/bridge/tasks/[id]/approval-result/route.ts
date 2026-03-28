import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bridge calls this to long-poll for the approval decision.
// Blocks until the user approves/denies (up to 10 minutes).
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const task = store.getTask(id);
  if (!task) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (task.state !== "waiting_approval") {
    return NextResponse.json(
      { error: "Not waiting for approval" },
      { status: 400 }
    );
  }

  return new Promise<NextResponse>((resolve) => {
    const timeout = setTimeout(() => {
      store.off("approvalResolved", onResolved);
      resolve(NextResponse.json({ approved: false, reason: "timeout" }));
    }, 10 * 60 * 1000);

    const onResolved = (taskId: string, approved: boolean) => {
      if (taskId !== id) return;
      clearTimeout(timeout);
      store.off("approvalResolved", onResolved);
      resolve(NextResponse.json({ approved }));
    };

    store.on("approvalResolved", onResolved);

    req.signal.addEventListener("abort", () => {
      clearTimeout(timeout);
      store.off("approvalResolved", onResolved);
    });
  });
}
