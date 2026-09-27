import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { calendarFor } from "@/lib/ical";

/** Calendar subscription. The token is the only credential; regenerate it from the profile to revoke. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const [u] = await db.select({ id: users.id, status: users.status }).from(users).where(eq(users.calendarToken, token)).limit(1);
  if (!u || u.status !== "active") return new NextResponse("Not found", { status: 404 });
  const body = await calendarFor(u.id);
  const download = req.nextUrl.searchParams.get("download") === "1";
  return new NextResponse(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "cache-control": "private, max-age=300",
      ...(download ? { "content-disposition": 'attachment; filename="saint-helen-liturgy.ics"' } : {}),
    },
  });
}
