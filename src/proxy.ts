import { NextRequest, NextResponse } from "next/server";

// Cheap first gate: bounce to the right login page when there is no session cookie at all.
// Real authorization (role, ministry) happens server-side in layouts and actions.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has("sh_session");

  if (pathname.startsWith("/app") && !hasSession) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !hasSession) {
    const url = new URL("/admin/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*"],
};
