import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { kiosks, liturgies } from "@/db/schema";
import { sha256 } from "./auth";
import { getLiturgies, liveAssignment } from "./schedule";
import { todayLocal } from "./time";

export const KIOSK_COOKIE = "sh_kiosk";

export async function getKiosk() {
  const c = await cookies();
  const key = c.get(KIOSK_COOKIE)?.value;
  if (!key) return null;
  return kioskByKey(key);
}

export async function kioskByKey(key: string) {
  const [k] = await db
    .select()
    .from(kiosks)
    .where(and(eq(kiosks.keyHash, sha256(key)), eq(kiosks.active, true)))
    .limit(1);
  if (!k) return null;
  // fire and forget
  db.update(kiosks).set({ lastSeenAt: new Date() }).where(eq(kiosks.id, k.id)).catch(() => {});
  return k;
}

export type KioskMass = {
  id: string;
  label: string;
  title: string | null;
  time: string;
  startsAt: string;
  location: string;
  notes: string | null;
  ministries: {
    id: string;
    name: string;
    shortName: string;
    color: string;
    slots: {
      positionId: string;
      label: string | null;
      assignmentId: string | null;
      name: string | null;
      userId: string | null;
      status: string | null;
      checkedInAt: string | null;
    }[];
  }[];
};

/** Today's published Masses, shaped for the kiosk. */
export async function kioskToday(): Promise<{ date: string; masses: KioskMass[] }> {
  const date = todayLocal();
  const list = await getLiturgies({ from: date, to: date, statuses: ["published"] });
  const masses: KioskMass[] = list.map((l) => {
    const byMin = new Map<string, KioskMass["ministries"][number]>();
    for (const p of l.positions) {
      if (!p.ministry.checkInEnabled) continue;
      const g = byMin.get(p.ministryId) ?? { id: p.ministryId, name: p.ministry.name, shortName: p.ministry.shortName, color: p.ministry.color, slots: [] };
      const a = liveAssignment(p);
      g.slots.push({
        positionId: p.id,
        label: p.label,
        assignmentId: a?.id ?? null,
        name: a ? `${a.user.firstName} ${a.user.lastName}` : null,
        userId: a?.userId ?? null,
        status: a?.status ?? null,
        checkedInAt: a?.checkedInAt ? a.checkedInAt.toISOString() : null,
      });
      byMin.set(p.ministryId, g);
    }
    return {
      id: l.id,
      label: l.label,
      title: l.title,
      time: l.time,
      startsAt: l.startsAt.toISOString(),
      location: l.location,
      notes: l.notes,
      ministries: [...byMin.values()],
    };
  });
  return { date, masses };
}

export async function liturgyIsToday(liturgyId: string) {
  const [l] = await db.select({ date: liturgies.date, status: liturgies.status }).from(liturgies).where(eq(liturgies.id, liturgyId));
  return !!l && l.date === todayLocal() && l.status === "published";
}
