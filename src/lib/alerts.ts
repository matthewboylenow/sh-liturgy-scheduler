import { and, eq, gte, inArray, ne, lte } from "drizzle-orm";
import { db } from "@/db";
import { users, ministries, ministryMembers, assignments, positions, liturgies, notificationLog } from "@/db/schema";
import { sendSms, sendEmail, emailShell } from "./notify";
import { env } from "./env";
import { fmtDateLong, fmtTime, fmtDate, addDaysLocal, todayLocal } from "./time";
import { getLiturgies, liveAssignment } from "./schedule";

/** Tell everyone else in a ministry that a specific slot just opened. */
export async function notifyMinistryOpenSlot(ministryId: string, liturgy: { id: string; date: string; time: string }, excludeUserId?: string) {
  const [m] = await db.select().from(ministries).where(eq(ministries.id, ministryId));
  const members = await db
    .select({ u: users })
    .from(ministryMembers)
    .innerJoin(users, eq(users.id, ministryMembers.userId))
    .where(eq(ministryMembers.ministryId, ministryId));
  const when = `${fmtDateLong(liturgy.date)} at ${fmtTime(liturgy.time)}`;
  const url = `${env.appUrl()}/app/liturgy/${liturgy.id}`;
  const text = `${env.parishName()} Liturgy: ${m?.shortName ?? "a"} slot open for ${when}. Take it: ${url}`;
  await Promise.all(
    members
      .filter(({ u }) => u.id !== excludeUserId && u.status === "active")
      .map(async ({ u }) => {
        if (u.notifySms && u.phone) return sendSms(u.phone, text, { userId: u.id, kind: "open_slot" });
        if (u.notifyEmail && u.email)
          return sendEmail(u.email, `Open ${m?.shortName ?? ""} slot: ${when}`, emailShell("A slot opened", `<p>${text}</p>`), { userId: u.id, kind: "open_slot" }, text);
      }),
  );
}

/** Reminders for Masses roughly two days out. Idempotent via reminderSentAt. */
export async function sendReminders(windowStartHours = 36, windowEndHours = 60) {
  const now = Date.now();
  const rows = await db
    .select({ a: assignments, p: positions, l: liturgies, u: users, m: ministries })
    .from(assignments)
    .innerJoin(positions, eq(positions.id, assignments.positionId))
    .innerJoin(liturgies, eq(liturgies.id, positions.liturgyId))
    .innerJoin(users, eq(users.id, assignments.userId))
    .innerJoin(ministries, eq(ministries.id, positions.ministryId))
    .where(
      and(
        ne(assignments.status, "declined"),
        eq(liturgies.status, "published"),
        gte(liturgies.startsAt, new Date(now + windowStartHours * 3600_000)),
        lte(liturgies.startsAt, new Date(now + windowEndHours * 3600_000)),
      ),
    );
  let sent = 0;
  for (const r of rows) {
    if (r.a.reminderSentAt) continue;
    const when = `${fmtDateLong(r.l.date)} at ${fmtTime(r.l.time)}`;
    const url = `${env.appUrl()}/app/liturgy/${r.l.id}`;
    const smsText = `${env.parishName()} Liturgy: you are scheduled as ${r.m.shortName}${r.p.label ? ` (${r.p.label})` : ""} on ${when}. Reply YES to confirm or NO if you cannot make it. ${url}`;
    let any = false;
    if (r.u.notifySms && r.u.phone) {
      const res = await sendSms(r.u.phone, smsText, { userId: r.u.id, kind: "reminder" });
      any ||= res.ok;
    }
    if (r.u.notifyEmail && r.u.email) {
      const res = await sendEmail(
        r.u.email,
        `Reminder: ${r.m.shortName} on ${fmtDate(r.l.date)} ${fmtTime(r.l.time)}`,
        emailShell(
          "You are scheduled this weekend",
          `<p>You are scheduled as <strong>${r.m.name}</strong>${r.p.label ? ` (${r.p.label})` : ""} on <strong>${when}</strong>${r.l.title ? `, ${r.l.title}` : ""}.</p>
           ${r.l.notes ? `<p><em>${r.l.notes}</em></p>` : ""}
           <p><a href="${url}" style="display:inline-block;background:#1F346D;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Confirm or request a sub</a></p>`,
        ),
        { userId: r.u.id, kind: "reminder" },
        smsText,
      );
      any ||= res.ok;
    }
    if (any) {
      await db.update(assignments).set({ reminderSentAt: new Date() }).where(eq(assignments.id, r.a.id));
      sent++;
    }
  }
  return { considered: rows.length, sent };
}

/** Daily digest of open slots in the next N days, one message per person per day. */
export async function sendOpenSlotDigests(daysAhead = 10) {
  const from = todayLocal();
  const list = await getLiturgies({ from: addDaysLocal(from, 1), to: addDaysLocal(from, daysAhead), statuses: ["published"] });
  // ministryId -> list of open slot descriptions
  const openByMinistry = new Map<string, { liturgyId: string; text: string }[]>();
  for (const l of list) {
    for (const p of l.positions) {
      const a = liveAssignment(p);
      if (a && a.status !== "sub_requested") continue;
      const arr = openByMinistry.get(p.ministryId) ?? [];
      arr.push({ liturgyId: l.id, text: `${fmtDate(l.date)} ${fmtTime(l.time)} ${p.ministry.shortName}${a ? " (sub needed)" : ""}` });
      openByMinistry.set(p.ministryId, arr);
    }
  }
  if (openByMinistry.size === 0) return { people: 0 };

  const members = await db
    .select({ u: users, ministryId: ministryMembers.ministryId })
    .from(ministryMembers)
    .innerJoin(users, eq(users.id, ministryMembers.userId))
    .where(inArray(ministryMembers.ministryId, [...openByMinistry.keys()]));

  // Skip anyone we already messaged with a digest in the last 20 hours
  const recent = await db
    .select({ userId: notificationLog.userId })
    .from(notificationLog)
    .where(and(eq(notificationLog.kind, "open_slots_digest"), gte(notificationLog.createdAt, new Date(Date.now() - 20 * 3600_000))));
  const recentSet = new Set(recent.map((r) => r.userId));

  const perUser = new Map<string, { u: typeof users.$inferSelect; items: Set<string> }>();
  for (const { u, ministryId } of members) {
    if (u.status !== "active" || recentSet.has(u.id)) continue;
    const entry = perUser.get(u.id) ?? { u, items: new Set<string>() };
    for (const s of openByMinistry.get(ministryId) ?? []) entry.items.add(s.text);
    perUser.set(u.id, entry);
  }

  let people = 0;
  for (const { u, items } of perUser.values()) {
    if (items.size === 0) continue;
    const lines = [...items].slice(0, 8);
    const more = items.size > 8 ? ` and ${items.size - 8} more` : "";
    const url = `${env.appUrl()}/app/schedule?open=1`;
    const text = `${env.parishName()} Liturgy: open slots in your ministries: ${lines.join("; ")}${more}. Sign up: ${url}`;
    let any = false;
    if (u.notifySms && u.phone) any ||= (await sendSms(u.phone, text, { userId: u.id, kind: "open_slots_digest" })).ok;
    else if (u.notifyEmail && u.email)
      any ||= (
        await sendEmail(
          u.email,
          `${items.size} open slot${items.size === 1 ? "" : "s"} coming up`,
          emailShell("Open slots in your ministries", `<ul>${[...items].map((i) => `<li>${i}</li>`).join("")}</ul><p><a href="${url}" style="display:inline-block;background:#CD5334;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">See open slots</a></p>`),
          { userId: u.id, kind: "open_slots_digest" },
          text,
        )
      ).ok;
    if (any) people++;
  }
  return { people };
}
