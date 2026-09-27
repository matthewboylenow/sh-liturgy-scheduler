import { and, eq, gte, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import { assignments, liturgies, ministries, massTimes, positions, users } from "@/db/schema";
import { todayLocal } from "./time";

export type CoverageRow = { key: string; label: string; seats: number; filled: number; checkedIn: number; noShows: number; pastSeats: number; pastFilled: number };
export type PersonRow = { userId: string; name: string; tags: string[]; ministries: string[]; served: number; checkedIn: number; noShows: number };

/**
 * Fill and no-show rates for a date range. A no-show is a live assignment on a past, check-in-enabled
 * Mass with no check-in recorded. Only published, non-cancelled Masses count.
 */
export async function coverageReport(from: string, to: string) {
  const today = todayLocal();
  const rows = await db
    .select({
      liturgyId: liturgies.id,
      date: liturgies.date,
      massTimeId: liturgies.massTimeId,
      massLabel: liturgies.label,
      positionId: positions.id,
      ministryId: ministries.id,
      ministryName: ministries.name,
      checkIn: ministries.checkInEnabled,
      assignmentId: assignments.id,
      status: assignments.status,
      checkedInAt: assignments.checkedInAt,
      userId: users.id,
      first: users.firstName,
      last: users.lastName,
      tags: users.tags,
    })
    .from(positions)
    .innerJoin(liturgies, eq(liturgies.id, positions.liturgyId))
    .innerJoin(ministries, eq(ministries.id, positions.ministryId))
    .leftJoin(assignments, and(eq(assignments.positionId, positions.id), ne(assignments.status, "declined")))
    .leftJoin(users, eq(users.id, assignments.userId))
    .where(and(gte(liturgies.date, from), lte(liturgies.date, to), eq(liturgies.status, "published")));

  const byMinistry = new Map<string, CoverageRow>();
  const byMass = new Map<string, CoverageRow>();
  const byPerson = new Map<string, PersonRow>();
  const bump = (map: Map<string, CoverageRow>, key: string, label: string, r: (typeof rows)[number]) => {
    const e = map.get(key) ?? { key, label, seats: 0, filled: 0, checkedIn: 0, noShows: 0, pastSeats: 0, pastFilled: 0 };
    const filled = !!r.assignmentId && r.status !== "sub_requested";
    const past = r.date < today;
    e.seats++;
    if (filled) e.filled++;
    if (past) {
      e.pastSeats++;
      if (filled) e.pastFilled++;
      if (filled && r.checkIn) {
        if (r.checkedInAt) e.checkedIn++;
        else e.noShows++;
      }
    }
    map.set(key, e);
  };
  for (const r of rows) {
    bump(byMinistry, r.ministryId, r.ministryName, r);
    bump(byMass, r.massTimeId ?? r.massLabel, r.massLabel, r);
    if (r.userId && r.status !== "sub_requested") {
      const p = byPerson.get(r.userId) ?? { userId: r.userId, name: `${r.first} ${r.last}`, tags: r.tags ?? [], ministries: [], served: 0, checkedIn: 0, noShows: 0 };
      if (!p.ministries.includes(r.ministryName)) p.ministries.push(r.ministryName);
      if (r.date < today) {
        p.served++;
        if (r.checkIn) {
          if (r.checkedInAt) p.checkedIn++;
          else p.noShows++;
        }
      }
      byPerson.set(r.userId, p);
    }
  }
  const order = (a: CoverageRow, b: CoverageRow) => a.label.localeCompare(b.label);
  const timeOrder = await db.select({ id: massTimes.id, sortOrder: massTimes.sortOrder }).from(massTimes);
  const so = new Map(timeOrder.map((t) => [t.id, t.sortOrder]));
  return {
    ministries: [...byMinistry.values()].sort(order),
    masses: [...byMass.values()].sort((a, b) => (so.get(a.key) ?? 999) - (so.get(b.key) ?? 999) || order(a, b)),
    people: [...byPerson.values()].sort((a, b) => b.noShows - a.noShows || b.served - a.served || a.name.localeCompare(b.name)),
    pastMasses: new Set(rows.filter((r) => r.date < today).map((r) => r.liturgyId)).size,
    masses_total: new Set(rows.map((r) => r.liturgyId)).size,
  };
}

export function pct(n: number, d: number) {
  return d ? `${Math.round((n / d) * 100)}%` : "";
}

export function toCsv(rows: (string | number)[][]) {
  return rows.map((r) => r.map((v) => (typeof v === "string" && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v))).join(",")).join("\r\n") + "\r\n";
}
