import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMyAssignments } from "@/lib/schedule";
import { eventFor, wrapCalendar } from "@/lib/ical";
import { env } from "@/lib/env";

/** One Mass as an .ics file, for the signed-in person's own assignment at it. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Sign in first", { status: 401 });
  const { id } = await ctx.params;
  const row = (await getMyAssignments(user.id)).find((r) => r.liturgy.id === id);
  if (!row) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(wrapCalendar([eventFor(row)], `${env.parishName()} Liturgy`), {
    headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="mass-${row.liturgy.date}-${row.liturgy.time.replace(":", "")}.ics"` },
  });
}
