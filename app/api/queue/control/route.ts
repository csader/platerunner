import { NextRequest, NextResponse } from "next/server";
import { getQueueManager } from "@/lib/server/live-queue-singleton";

export async function POST(request: NextRequest) {
  const queue = getQueueManager();
  if (!queue) {
    return NextResponse.json(
      { error: "Printer not connected" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { action, swapMethod, swapSequence } = body;

  if (swapMethod) {
    queue.setSwapMethod(swapMethod);
  }

  if (swapSequence) {
    queue.setSwapSequence(swapSequence);
  }

  switch (action) {
    case "start":
      queue.start();
      break;
    case "pause":
      queue.pause();
      break;
    case "resume":
      queue.resume();
      break;
    case "stop":
      queue.stop();
      break;
    case "skip":
      queue.skipCurrent();
      break;
    case "retry":
      queue.retryCurrent();
      break;
    default:
      if (!swapMethod && !swapSequence) {
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
      }
  }

  return NextResponse.json({ success: true });
}
