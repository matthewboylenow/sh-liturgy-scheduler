import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assignments, auditLog } from "@/db/schema";
import { getKiosk, liturgyIsToday } from "@/lib/kiosk";

/** Body: { assignmentId, undo?: boolean } */
export async function POST(req: NextRequest) {
  const k = await getKiosk();
  if (!k) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { assignmentId, undo } = (await req.json()) as { assignmentId?: string; undo?: boolean };
  if (!assignmentId) return NextResponse.json({ error: "assignmentId required" }, { status: 400 });

  const a = await db.query.assignments.findFirst({ where: eq(assignments.id, assignmentId), with: { position: true } });
  if (!a || a.status === "declined") return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!(await liturgyIsToday(a.position.liturgyId))) return NextResponse.json({ error: "That Mass is not today." }, { status: 400 });

  if (undo) {
    // Only allow undo within 5 minutes, from the kiosk
    if (!a.checkedInAt || Date.now() - a.checkedInAt.getTime() > 5 * 60_000) return NextResponse.json({ error: "Too late to undo from the kiosk. Staff can undo it." }, { status: 400 });
    await db.update(assignments).set({ checkedInAt: null, checkedInVia: null }).where(eq(assignments.id, assignmentId));
  } else {
    await db.update(assignments).set({ checkedInAt: new Date(), checkedInVia: `kiosk:${k.id}`, status: "confirmed", updatedAt: new Date() }).where(eq(assignments.id, assignmentId));
  }
  await db.insert(auditLog).values({ actorId: a.userId, action: undo ? "checkin.undo" : "checkin", subjectType: "assignment", subjectId: assignmentId, detail: `kiosk:${k.name}` });
  return NextResponse.json({ ok: true });
}
