import { NextRequest, NextResponse } from "next/server";
import { beginMicrosoft, microsoftConfigured } from "@/lib/microsoft";

export async function GET(req: NextRequest) {
  if (!microsoftConfigured()) {
    return NextResponse.redirect(new URL("/admin/login?error=ms_not_configured", req.url));
  }
  const next = req.nextUrl.searchParams.get("next") ?? "/admin";
  const { url, state, nonce, verifier } = beginMicrosoft(next);
  const res = NextResponse.redirect(url);
  const opts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 };
  res.cookies.set("ms_state", state, opts);
  res.cookies.set("ms_nonce", nonce, opts);
  res.cookies.set("ms_verifier", verifier, opts);
  res.cookies.set("ms_next", next.startsWith("/") ? next : "/admin", opts);
  return res;
}
