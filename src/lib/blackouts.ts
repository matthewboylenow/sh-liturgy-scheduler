import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { blackouts } from "@/db/schema";
import { todayLocal } from "./time";

export type Blackout = typeof blackouts.$inferSelect;

export async function blackoutsFor(userId: string, opts: { upcomingOnly?: boolean } = {}) {
  const conds = [eq(blackouts.userId, userId)];
  if (opts.upcomingOnly) conds.push(gte(blackouts.toDate, todayLocal()));
  return db.select().from(blackouts).where(and(...conds)).orderBy(asc(blackouts.fromDate));
}

export function isAway(list: Pick<Blackout, "fromDate" | "toDate">[], date: string) {
  return list.some((b) => b.fromDate <= date && date <= b.toDate);
}

export async function onBlackout(userId: string, date: string) {
  const rows = await db
    .select({ id: blackouts.id })
    .from(blackouts)
    .where(and(eq(blackouts.userId, userId), lte(blackouts.fromDate, date), gte(blackouts.toDate, date)))
    .limit(1);
  return rows.length > 0;
}

/** User ids among `userIds` who are away on `date`. */
export async function awayOn(userIds: string[], date: string): Promise<Set<string>> {
  if (!userIds.length) return new Set();
  const rows = await db
    .select({ userId: blackouts.userId })
    .from(blackouts)
    .where(and(inArray(blackouts.userId, userIds), lte(blackouts.fromDate, date), gte(blackouts.toDate, date)));
  return new Set(rows.map((r) => r.userId));
}
