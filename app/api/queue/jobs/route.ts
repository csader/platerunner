import { NextRequest, NextResponse } from "next/server";
import { getQueueManager } from "@/lib/server/live-queue-singleton";
import { QueueJob } from "@/lib/types/live-queue";

export async function POST(request: NextRequest) {
  const queue = getQueueManager();
  if (!queue) {
    return NextResponse.json(
      { error: "Printer not connected" },
      { status: 400 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const copies = parseInt((formData.get("copies") as string) || "1", 10);

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const id =
      Math.random().toString(36).substring(2) + Date.now().toString(36);
    const name = file.name.replace(/\.3mf$/i, "");

    const job: QueueJob = {
      id,
      name,
      fileBuffer,
      copies,
      currentCopy: 0,
      status: "pending",
    };

    queue.addJob(job);

    return NextResponse.json({ id, name });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const queue = getQueueManager();
  if (!queue) {
    return NextResponse.json(
      { error: "Printer not connected" },
      { status: 400 }
    );
  }

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Missing job id" }, { status: 400 });
  }

  queue.removeJob(id);
  return NextResponse.json({ success: true });
}
