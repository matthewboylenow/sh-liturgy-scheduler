import { NextRequest, NextResponse } from "next/server";
import { sendNoShowAlerts } from "@/lib/alerts";
import { env } from "@/lib/env";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = env.cronSecret();
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await sendNoShowAlerts());
}
