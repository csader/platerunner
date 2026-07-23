import { NextRequest, NextResponse } from "next/server";
import { initialize } from "@/lib/server/live-queue-singleton";
import { PrinterConfig } from "@/lib/types/live-queue";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PrinterConfig;

    if (!body.ip || !body.serial || !body.accessCode) {
      return NextResponse.json(
        { error: "Missing required fields: ip, serial, accessCode" },
        { status: 400 }
      );
    }

    await initialize(body);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
