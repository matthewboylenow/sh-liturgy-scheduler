import { and, asc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { assignments, liturgies, positions, ministries, ministryMembers, users, auditLog, type Liturgy } from "@/db/schema";
import { addDaysLocal, todayLocal } from "./time";
import type { SessionUser } from "./auth";
import { canManageMinistry } from "./auth";

export type PositionWithAssignment = {
  id: string;
  liturgyId: string;
  ministryId: string;
  label: string | null;
  sortOrder: number;
  ministry: { id: string; name: string; shortName: string; color: string; checkInEnabled: boolean; sortOrder: number };
  assignments: {
    id: string;
    status: "signed_up" | "confirmed" | "sub_requested" | "declined";
    userId: string;
    checkedInAt: Date | null;
    user: { id: string; firstName: string; lastName: string; phone: string | null };
  }[];
};

export type LiturgyFull = Liturgy & { positions: PositionWithAssignment[] };

export const LIVE = ["signed_up", "confirmed", "sub_requested"] as const;

/** The single live assignment for a position, if any. */
export function liveAssignment(p: PositionWithAssignment) {
  return p.assignments.find((a) => a.status !== "declined") ?? null;
}

export async function getLiturgies(opts: {
  from?: string;
  to?: string;
  statuses?: Liturgy["status"][];
  ids?: string[];
}): Promise<LiturgyFull[]> {
  const conds = [];
  if (opts.from) conds.push(gte(liturgies.date, opts.from));
  if (opts.to) conds.push(lte(liturgies.date, opts.to));
  if (opts.statuses?.length) conds.push(inArray(liturgies.status, opts.statuses));
  if (opts.ids?.length) conds.push(inArray(liturgies.id, opts.ids));

  const rows = await db.query.liturgies.findMany({
    where: conds.length ? and(...conds) : undefined,
    orderBy: [asc(liturgies.startsAt)],
    with: {
      positions: {
        orderBy: [asc(positions.sortOrder)],
        with: {
          ministry: {
            columns: { id: true, name: true, shortName: true, color: true, checkInEnabled: true, sortOrder: true },
          },
          assignments: {
            columns: { id: true, status: true, userId: true, checkedInAt: true },
            with: { user: { columns: { id: true, firstName: true, lastName: true, phone: true } } },
          },
        },
      },
    },
  });
  // Sort positions by ministry order then position order
  for (const l of rows) {
    l.positions.sort((a, b) => a.ministry.sortOrder - b.ministry.sortOrder || a.sortOrder - b.sortOrder);
  }
  return rows as LiturgyFull[];
}

export async function getLiturgy(id: string): Promise<LiturgyFull | null> {
  const rows = await getLiturgies({ ids: [id] });
  return rows[0] ?? null;
}

/** Upcoming published liturgies, default next 8 weeks. */
export async function getUpcomingPublished(weeks = 8) {
  const from = todayLocal();
  return getLiturgies({ from, to: addDaysLocal(from, weeks * 7), statuses: ["published"] });
}

/** Group positions by ministry for display. */
export function groupByMinistry(l: LiturgyFull) {
  const map = new Map<string, { ministry: PositionWithAssignment["ministry"]; positions: PositionWithAssignment[] }>();
  for (const p of l.positions) {
    const g = map.get(p.ministryId) ?? { ministry: p.ministry, positions: [] };
    g.positions.push(p);
    map.set(p.ministryId, g);
  }
  return [...map.values()].sort((a, b) => a.ministry.sortOrder - b.ministry.sortOrder);
}

export function coverage(l: LiturgyFull) {
  const total = l.positions.length;
  const filled = l.positions.filter((p) => {
    const a = liveAssignment(p);
    return a && a.status !== "sub_requested";
  }).length;
  const subs = l.positions.filter((p) => liveAssignment(p)?.status === "sub_requested").length;
  return { total, filled, open: total - filled, subs };
}

export class ScheduleError extends Error {}

/** Volunteer claims an open (or sub-requested) position. */
export async function claimPosition(user: SessionUser, positionId: string, actorId?: string) {
  const pos = await db.query.positions.findFirst({
    where: eq(positions.id, positionId),
    with: { liturgy: true, assignments: true },
  });
  if (!pos) throw new ScheduleError("That slot no longer exists.");
  const acting = actorId ?? user.id;
  const isSelf = acting === user.id;

  if (isSelf) {
    if (pos.liturgy.status !== "published") throw new ScheduleError("That Mass is not open for sign-ups.");
    if (pos.liturgy.startsAt < new Date()) throw new ScheduleError("That Mass has already happened.");
    if (!user.ministryIds.includes(pos.ministryId)) throw new ScheduleError("You are not a member of that ministry.");
  }

  const live = pos.assignments.find((a) => a.status !== "declined");
  if (live && live.userId === user.id) throw new ScheduleError("You are already signed up for that slot.");
  if (live && live.status !== "sub_requested") throw new ScheduleError("Someone already took that slot.");

  // One live assignment per person per Mass
  const already = await db
    .select({ id: assignments.id })
    .from(assignments)
    .innerJoin(positions, eq(positions.id, assignments.positionId))
    .where(and(eq(positions.liturgyId, pos.liturgyId), eq(assignments.userId, user.id), ne(assignments.status, "declined")))
    .limit(1);
  if (already[0] && isSelf) throw new ScheduleError("You are already serving at that Mass.");

  if (live) {
    // taking over a sub request
    await db.update(assignments).set({ status: "declined", updatedAt: new Date() }).where(eq(assignments.id, live.id));
  }
  try {
    await db.insert(assignments).values({
      positionId,
      userId: user.id,
      status: "signed_up",
      assignedById: isSelf ? null : acting,
    });
  } catch {
    throw new ScheduleError("Someone grabbed that slot a moment ago. Pick another.");
  }
  await db.insert(auditLog).values({
    actorId: acting,
    action: isSelf ? "assignment.claim" : "assignment.assign",
    subjectType: "position",
    subjectId: positionId,
    detail: `${user.firstName} ${user.lastName}`,
  });
}

/** Volunteer drops a slot (frees it) or requests a sub (keeps it, flagged). */
export async function changeAssignment(
  actor: SessionUser,
  assignmentId: string,
  action: "drop" | "request_sub" | "confirm" | "undo_sub",
) {
  const a = await db.query.assignments.findFirst({
    where: eq(assignments.id, assignmentId),
    with: { position: { with: { liturgy: true } } },
  });
  if (!a || a.status === "declined") throw new ScheduleError("That assignment no longer exists.");
  const own = a.userId === actor.id;
  if (!own && !canManageMinistry(actor, a.position.ministryId)) throw new ScheduleError("You can't change that assignment.");
  if (a.position.liturgy.startsAt < new Date() && action !== "confirm") throw new ScheduleError("That Mass has already happened.");

  const status = action === "drop" ? "declined" : action === "request_sub" ? "sub_requested" : action === "confirm" ? "confirmed" : "signed_up";
  await db.update(assignments).set({ status, updatedAt: new Date() }).where(eq(assignments.id, assignmentId));
  await db.insert(auditLog).values({
    actorId: actor.id,
    action: `assignment.${action}`,
    subjectType: "assignment",
    subjectId: assignmentId,
  });
  return a;
}

/** Upcoming assignments for one person. */
export async function getMyAssignments(userId: string, opts: { past?: boolean } = {}) {
  const now = new Date();
  return db
    .select({
      assignment: assignments,
      position: positions,
      liturgy: liturgies,
      ministry: { id: ministries.id, name: ministries.name, shortName: ministries.shortName, color: ministries.color },
    })
    .from(assignments)
    .innerJoin(positions, eq(positions.id, assignments.positionId))
    .innerJoin(liturgies, eq(liturgies.id, positions.liturgyId))
    .innerJoin(ministries, eq(ministries.id, positions.ministryId))
    .where(
      and(
        eq(assignments.userId, userId),
        ne(assignments.status, "declined"),
        opts.past ? lte(liturgies.startsAt, now) : gte(liturgies.startsAt, now),
        eq(liturgies.status, "published"),
      ),
    )
    .orderBy(opts.past ? sql`${liturgies.startsAt} desc` : asc(liturgies.startsAt))
    .limit(opts.past ? 50 : 200);
}

/** Members of a ministry, for coordinator views and manual assignment. */
export async function getMinistryMembers(ministryId: string) {
  return db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      email: users.email,
      status: users.status,
      isCoordinator: ministryMembers.isCoordinator,
    })
    .from(ministryMembers)
    .innerJoin(users, eq(users.id, ministryMembers.userId))
    .where(eq(ministryMembers.ministryId, ministryId))
    .orderBy(asc(users.lastName), asc(users.firstName));
}
