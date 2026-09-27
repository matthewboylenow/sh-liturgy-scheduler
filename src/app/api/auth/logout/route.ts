import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  await destroySession();
  // Signing out keeps the "remember this device" cookie; it only skips the code, never the password.
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
export const GET = POST;
