import { NextRequest, NextResponse } from "next/server";
import { getQueueManager } from "@/lib/server/live-queue-singleton";

export async function PUT(request: NextRequest) {
  const queue = getQueueManager();
  if (!queue) {
    return NextResponse.json(
      { error: "Printer not connected" },
      { status: 400 }
    );
  }

  const { ids } = await request.json();
  if (!Array.isArray(ids)) {
    return NextResponse.json(
      { error: "ids must be an array" },
      { status: 400 }
    );
  }

  queue.reorderJobs(ids);
  return NextResponse.json({ success: true });
}
