import { NextRequest, NextResponse } from "next/server";
import { sendReminders } from "@/lib/alerts";
import { env } from "@/lib/env";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = env.cronSecret();
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await sendReminders();
  return NextResponse.json(result);
}
