import {
  getPrinterClient,
  getQueueManager,
} from "@/lib/server/live-queue-singleton";

export const dynamic = "force-dynamic";

export async function GET() {
  const client = getPrinterClient();
  const queue = getQueueManager();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      function send(data: object) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      }

      if (!client || !queue) {
        send({ state: "idle", jobs: [], currentJobId: null, printerStatus: { connected: false, gcodeState: "UNKNOWN", mcPercent: 0, mcRemainingTime: 0, currentFile: null, error: null }, swapMethod: "bake", error: null });
      } else {
        send(queue.getSnapshot());
      }

      const unsubscribe = queue?.onUpdate((snapshot) => {
        try {
          send(snapshot);
        } catch {
          unsubscribe?.();
        }
      });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe?.();
      };

      // AbortSignal not available on ReadableStream cancel, use a flag
      let closed = false;
      const originalCancel = controller.close.bind(controller);
      controller.close = () => {
        if (!closed) {
          closed = true;
          cleanup();
          originalCancel();
        }
      };
    },
    cancel() {
      // Stream cancelled by client disconnect
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
