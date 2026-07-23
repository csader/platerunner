import { NextResponse } from "next/server";
import { teardown } from "@/lib/server/live-queue-singleton";

export async function POST() {
  await teardown();
  return NextResponse.json({ success: true });
}
