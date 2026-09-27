import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { and, eq, gte, ne, asc } from "drizzle-orm";
import { db } from "@/db";
import { users, assignments, positions, liturgies, auditLog } from "@/db/schema";
import { env } from "@/lib/env";
import { notifyMinistryOpenSlot } from "@/lib/alerts";
import { fmtDate, fmtTime } from "@/lib/time";

/**
 * Twilio posts here when a volunteer replies to a text.
 * YES / Y / CONFIRM -> confirm their next reminded assignment(s)
 * NO / N / CANT     -> mark as needing a sub and alert the ministry
 * Anything else     -> a short help reply
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const params = Object.fromEntries(new URLSearchParams(raw));
  const t = env.twilio();

  if (t.authToken) {
    const sig = req.headers.get("x-twilio-signature") ?? "";
    const url = `${env.appUrl()}/api/twilio/inbound`;
    if (!twilio.validateRequest(t.authToken, sig, url, params)) {
      return new NextResponse("bad signature", { status: 403 });
    }
  }

  const from = params.From;
  const body = (params.Body ?? "").trim().toUpperCase();
  const twiml = (msg: string) => new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(msg)}</Message></Response>`, { headers: { "content-type": "text/xml" } });

  const [user] = await db.select().from(users).where(eq(users.phone, from)).limit(1);
  if (!user) return twiml(`This number is not on a ${env.parishName()} account. Sign in at ${env.appUrl()} to update your profile.`);

  if (/^(STOP|UNSUBSCRIBE|CANCEL|END|QUIT)$/.test(body)) {
    // Twilio handles STOP itself for long codes; we also honor the preference.
    await db.update(users).set({ notifySms: false }).where(eq(users.id, user.id));
    return new NextResponse("<Response></Response>", { headers: { "content-type": "text/xml" } });
  }

  const yes = /^(Y|YES|CONFIRM|CONFIRMED|OK|👍)/.test(body);
  const no = /^(N|NO|CANT|CAN'T|CANNOT|SUB)/.test(body);
  if (!yes && !no) return twiml(`Reply YES to confirm your next Mass or NO if you need a sub. ${env.appUrl()}/app`);

  // The next upcoming assignment(s) that were reminded most recently
  const rows = await db
    .select({ a: assignments, l: liturgies, p: positions })
    .from(assignments)
    .innerJoin(positions, eq(positions.id, assignments.positionId))
    .innerJoin(liturgies, eq(liturgies.id, positions.liturgyId))
    .where(and(eq(assignments.userId, user.id), ne(assignments.status, "declined"), gte(liturgies.startsAt, new Date()), eq(liturgies.status, "published")))
    .orderBy(asc(liturgies.startsAt))
    .limit(5);
  const reminded = rows.filter((r) => r.a.reminderSentAt);
  const target = (reminded.length ? reminded : rows).slice(0, 1);
  if (!target.length) return twiml("You have nothing scheduled right now.");

  const r = target[0];
  const when = `${fmtDate(r.l.date)} ${fmtTime(r.l.time)}`;
  if (yes) {
    await db.update(assignments).set({ status: "confirmed", updatedAt: new Date() }).where(eq(assignments.id, r.a.id));
    await db.insert(auditLog).values({ actorId: user.id, action: "assignment.confirm.sms", subjectId: r.a.id });
    return twiml(`Thanks, ${user.firstName}. You are confirmed for ${when}.`);
  }
  await db.update(assignments).set({ status: "sub_requested", updatedAt: new Date() }).where(eq(assignments.id, r.a.id));
  await db.insert(auditLog).values({ actorId: user.id, action: "assignment.request_sub.sms", subjectId: r.a.id });
  await notifyMinistryOpenSlot(r.p.ministryId, r.l, user.id);
  return twiml(`Got it. ${when} is marked as needing a sub and your ministry has been told.`);
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}
