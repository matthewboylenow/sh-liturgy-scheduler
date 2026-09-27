import { NextRequest, NextResponse } from "next/server";
import { kioskByKey, KIOSK_COOKIE } from "@/lib/kiosk";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") ?? "";
  const k = key ? await kioskByKey(key) : null;
  const res = NextResponse.redirect(new URL(k ? "/kiosk" : "/kiosk?bad=1", req.url));
  if (k) {
    res.cookies.set(KIOSK_COOKIE, key, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 365 * 86400 });
  }
  return res;
}
