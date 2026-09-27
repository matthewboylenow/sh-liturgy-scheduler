import Link from "next/link";
import { and, eq, gte, count, ne } from "drizzle-orm";
import { requireStaff } from "@/lib/auth";
import { db } from "@/db";
import { users, assignments, positions, liturgies } from "@/db/schema";
import { getLiturgies, coverage, liveAssignment } from "@/lib/schedule";
import { addDaysLocal, fmtDate, fmtTime, todayLocal } from "@/lib/time";
import { PageTitle, MinistryPill } from "@/components/shell";
import { Flash } from "@/components/flash";

export default async function AdminHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireStaff();
  const today = todayLocal();
  const scope = (mid: string) => user.role === "admin" || user.coordinatorOf.includes(mid) || user.ministryIds.includes(mid);

  const [upcoming, drafts, invited, subs] = await Promise.all([
    getLiturgies({ from: today, to: addDaysLocal(today, 21), statuses: ["published"] }),
    db.select({ n: count() }).from(liturgies).where(and(eq(liturgies.status, "draft"), gte(liturgies.date, today))),
    db.select({ n: count() }).from(users).where(eq(users.status, "invited")),
    db
      .select({ a: assignments, p: positions, l: liturgies, u: users })
      .from(assignments)
      .innerJoin(positions, eq(positions.id, assignments.positionId))
      .innerJoin(liturgies, eq(liturgies.id, positions.liturgyId))
      .innerJoin(users, eq(users.id, assignments.userId))
      .where(and(eq(assignments.status, "sub_requested"), gte(liturgies.date, today), ne(liturgies.status, "cancelled"))),
  ]);

  const openSoon = upcoming.flatMap((l) =>
    l.positions.filter((p) => scope(p.ministryId) && !liveAssignment(p)).map((p) => ({ l, p })),
  );
  const mySubs = subs.filter((s) => scope(s.p.ministryId));

  return (
    <>
      <PageTitle title="Overview" subtitle="Next three weekends." actions={<Link href="/admin/schedule" className="btn-primary">Schedule</Link>} />
      <Flash sp={sp} />
      {sp.denied && <p className="mb-4 text-sm text-rust">That page is for admins.</p>}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Open slots, next 3 weeks" value={openSoon.length} tone={openSoon.length ? "rust" : "ok"} />
        <Stat label="Sub requests" value={mySubs.length} tone={mySubs.length ? "gold" : "ok"} />
        <Stat label="Unpublished drafts" value={drafts[0]?.n ?? 0} href="/admin/schedule?status=draft" />
        <Stat label="Invites not yet accepted" value={invited[0]?.n ?? 0} href="/admin/people?status=invited" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="border-b border-line px-4 py-2 font-semibold">Coverage by Mass</div>
          <ul className="divide-y divide-line/70 text-sm">
            {upcoming.length === 0 && <li className="px-4 py-4 text-muted">No published Masses in the next three weeks.</li>}
            {upcoming.map((l) => {
              const c = coverage(l);
              const pct = c.total ? Math.round((c.filled / c.total) * 100) : 0;
              return (
                <li key={l.id} className="flex items-center gap-3 px-4 py-2">
                  <Link href={`/admin/schedule/${l.id}`} className="w-40 shrink-0 whitespace-nowrap font-medium hover:underline">
                    {fmtDate(l.date)} · {fmtTime(l.time)}
                  </Link>
                  <div className="h-2 flex-1 overflow-hidden rounded bg-line">
                    <div className={`h-full ${pct === 100 ? "bg-green-600" : pct >= 70 ? "bg-navy" : "bg-rust"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-20 text-right text-xs text-muted">
                    {c.filled}/{c.total}
                    {c.subs ? ` · ${c.subs} sub` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card self-start">
          <div className="border-b border-line px-4 py-2 font-semibold">Needs attention</div>
          <ul className="divide-y divide-line/70 text-sm">
            {mySubs.length === 0 && openSoon.length === 0 && <li className="px-4 py-4 text-muted">Nothing right now.</li>}
            {mySubs.map((s) => (
              <li key={s.a.id} className="flex items-center justify-between gap-2 px-4 py-2">
                <span>
                  {s.u.firstName} {s.u.lastName} needs a sub · {fmtDate(s.l.date)} {fmtTime(s.l.time)}
                </span>
                <Link href={`/admin/schedule/${s.l.id}`} className="whitespace-nowrap text-rust underline">
                  Find a sub
                </Link>
              </li>
            ))}
            {openSoon.slice(0, 10).map(({ l, p }) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2">
                <span className="flex items-center gap-2">
                  <MinistryPill ministry={p.ministry} />
                  {fmtDate(l.date)} · {fmtTime(l.time)}
                </span>
                <Link href={`/admin/schedule/${l.id}`} className="text-rust underline">
                  Assign
                </Link>
              </li>
            ))}
            {openSoon.length > 10 && <li className="px-4 py-2 text-xs text-muted">and {openSoon.length - 10} more open slots</li>}
          </ul>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, tone, href }: { label: string; value: number; tone?: "rust" | "gold" | "ok"; href?: string }) {
  const color = tone === "rust" ? "text-rust" : tone === "gold" ? "text-yellow-800" : tone === "ok" ? "text-green-700" : "text-navy";
  const inner = (
    <div className="card p-4">
      <div className={`font-serif text-3xl ${color}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
