import { NextRequest } from "next/server";
import { store } from "@/lib/store";
import type { Task } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const encoder = new TextEncoder();

  const send = (data: unknown) =>
    encoder.encode(`data: ${JSON.stringify(data)}\n\n`);

  const stream = new ReadableStream({
    start(controller) {
      const task = store.getTask(id);
      if (!task) {
        controller.enqueue(send({ type: "error", message: "Task not found" }));
        controller.close();
        return;
      }

      // Immediately send full snapshot
      controller.enqueue(send({ type: "snapshot", task }));

      const onUpdate = (updated: Task) => {
        if (updated.id !== id) return;
        controller.enqueue(send({ type: "snapshot", task: updated }));
        if (["completed", "failed", "denied"].includes(updated.state)) {
          cleanup();
          controller.close();
        }
      };

      store.on("taskUpdated", onUpdate);

      // Keepalive ping every 15s so proxies don't close the connection
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          cleanup();
        }
      }, 15_000);

      function cleanup() {
        store.off("taskUpdated", onUpdate);
        clearInterval(pingInterval);
      }

      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
