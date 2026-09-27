import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { env } from "./env";
import { getMyAssignments } from "./schedule";
import { addDaysLocal, todayLocal } from "./time";

/** Return the user's calendar token, creating one on first use. */
export async function calendarTokenFor(userId: string, current: string | null) {
  if (current) return current;
  const token = randomBytes(18).toString("base64url");
  await db.update(users).set({ calendarToken: token }).where(eq(users.id, userId));
  return token;
}

export async function regenerateCalendarToken(userId: string) {
  const token = randomBytes(18).toString("base64url");
  await db.update(users).set({ calendarToken: token }).where(eq(users.id, userId));
  return token;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

type Row = Awaited<ReturnType<typeof getMyAssignments>>[number];

export function eventFor(r: Row): string {
  const start = r.liturgy.startsAt;
  const end = new Date(start.getTime() + 75 * 60_000);
  const role = `${r.ministry.name}${r.position.label ? ` (${r.position.label})` : ""}`;
  return [
    "BEGIN:VEVENT",
    `UID:${r.assignment.id}@${new URL(env.appUrl()).host}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`${role}, ${r.liturgy.label}`)}`,
    `LOCATION:${esc(`${env.parishName()}, ${r.liturgy.location}`)}`,
    `DESCRIPTION:${esc(`${r.liturgy.title ?? r.liturgy.label}. Confirm or ask for a sub: ${env.appUrl()}/app/liturgy/${r.liturgy.id}`)}`,
    `URL:${env.appUrl()}/app/liturgy/${r.liturgy.id}`,
    "END:VEVENT",
  ].join("\r\n");
}

export function wrapCalendar(events: string[], name: string) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${esc(env.parishName())} Liturgy//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

/** All of a person's assignments from 60 days back onward, as a calendar. */
export async function calendarFor(userId: string) {
  const [upcoming, past] = await Promise.all([getMyAssignments(userId), getMyAssignments(userId, { past: true })]);
  const cutoff = addDaysLocal(todayLocal(), -60);
  const rows = [...past.filter((r) => r.liturgy.date >= cutoff), ...upcoming];
  return wrapCalendar(rows.map(eventFor), `${env.parishName()} Liturgy`);
}
