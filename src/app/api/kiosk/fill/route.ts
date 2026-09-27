import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { assignments, positions, auditLog } from "@/db/schema";
import { getKiosk, liturgyIsToday } from "@/lib/kiosk";
import { getMinistryMembers } from "@/lib/schedule";

/** GET ?ministryId= -> members list for the fill-in picker */
export async function GET(req: NextRequest) {
  const k = await getKiosk();
  if (!k) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ministryId = req.nextUrl.searchParams.get("ministryId");
  if (!ministryId) return NextResponse.json({ error: "ministryId required" }, { status: 400 });
  const members = await getMinistryMembers(ministryId);
  return NextResponse.json({
    members: members.filter((m) => m.status !== "inactive").map((m) => ({ id: m.id, name: `${m.firstName} ${m.lastName}` })),
  });
}

/** POST { positionId, userId } -> someone walks in and takes an open slot (or covers a sub request), checked in immediately */
export async function POST(req: NextRequest) {
  const k = await getKiosk();
  if (!k) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { positionId, userId } = (await req.json()) as { positionId?: string; userId?: string };
  if (!positionId || !userId) return NextResponse.json({ error: "positionId and userId required" }, { status: 400 });

  const p = await db.query.positions.findFirst({ where: eq(positions.id, positionId), with: { assignments: true } });
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!(await liturgyIsToday(p.liturgyId))) return NextResponse.json({ error: "That Mass is not today." }, { status: 400 });

  const live = p.assignments.find((a) => a.status !== "declined");
  if (live && live.status !== "sub_requested") return NextResponse.json({ error: "That slot is already filled." }, { status: 409 });
  if (live) await db.update(assignments).set({ status: "declined", updatedAt: new Date() }).where(eq(assignments.id, live.id));

  // If this person is already on another slot at this Mass, don't double-book
  const dup = await db
    .select({ id: assignments.id })
    .from(assignments)
    .innerJoin(positions, eq(positions.id, assignments.positionId))
    .where(and(eq(positions.liturgyId, p.liturgyId), eq(assignments.userId, userId), ne(assignments.status, "declined")))
    .limit(1);
  if (dup[0]) return NextResponse.json({ error: "They are already serving at this Mass." }, { status: 409 });

  const [a] = await db
    .insert(assignments)
    .values({ positionId, userId, status: "confirmed", checkedInAt: new Date(), checkedInVia: `kiosk:${k.id}` })
    .returning();
  await db.insert(auditLog).values({ actorId: userId, action: "checkin.fill_in", subjectType: "position", subjectId: positionId, detail: `kiosk:${k.name}` });
  return NextResponse.json({ ok: true, assignmentId: a.id });
}
