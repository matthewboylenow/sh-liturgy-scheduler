import Link from "next/link";
import { asc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { massTimes } from "@/db/schema";
import { getUpcomingPublished, liveAssignment } from "@/lib/schedule";
import { PageTitle } from "@/components/shell";
import { Alert } from "@/components/ui";
import { SignupGrid, type GridColumn, type GridMass, type GridRow, type SeatOption } from "@/components/signup-grid";
import { blackoutsFor, isAway } from "@/lib/blackouts";
import { DAY_NAMES, fmtTime, weekendOf } from "@/lib/time";
import { parseISO, format } from "date-fns";

export const metadata = { title: "Sign up" };

const shortTime = (t: string) => fmtTime(t).replace(":00", "").replace(" AM", "a").replace(" PM", "p");

export default async function SchedulePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const weeks = [8, 16, 26].includes(Number(sp.weeks)) ? Number(sp.weeks) : 8;
  const all = await getUpcomingPublished(weeks);
  const myBlackouts = await blackoutsFor(user.id);
  const times = await db.select().from(massTimes).orderBy(asc(massTimes.sortOrder));

  // Columns: the weekly pattern, Saturday first. Only Mass times that actually occur in the range.
  const usedTimeIds = new Set(all.map((l) => l.massTimeId));
  const columns: GridColumn[] = times
    .filter((t) => usedTimeIds.has(t.id))
    .map((t) => ({ key: t.id, label: `${DAY_NAMES[t.dayOfWeek].slice(0, 3)} ${shortTime(t.time)}` }));

  // Rows: one per weekend. Weekday Masses (holy days) get their own row under that week.
  const rowsMap = new Map<string, GridRow>();
  for (const l of all) {
    const relevant = l.positions.filter((p) => user.ministryIds.includes(p.ministryId));
    const myLive = l.positions.map((p) => ({ p, a: liveAssignment(p) })).find((x) => x.a?.userId === user.id);
    if (relevant.length === 0 && !myLive) continue;

    // Open seats for me, grouped by ministry + role
    const byKey = new Map<string, SeatOption>();
    for (const p of relevant) {
      const a = liveAssignment(p);
      if (a && a.status !== "sub_requested") continue;
      const role = p.label && !/^#\d+$/.test(p.label) ? p.label.replace(/\s\d+$/, "") : null;
      const key = `${p.ministryId}|${role ?? ""}`;
      const o = byKey.get(key) ?? { key, ministryShort: p.ministry.shortName, ministryName: p.ministry.name, role, positionIds: [] };
      o.positionIds.push(p.id);
      byKey.set(key, o);
    }
    const options = [...byKey.values()].sort((a, b) => a.ministryName.localeCompare(b.ministryName) || (a.role ?? "").localeCompare(b.role ?? ""));
    const dow = parseISO(l.date).getDay();
    const weekend = dow === 0 || dow === 6;
    const [satKey] = weekendOf(l.date);
    const rowKey = weekend ? satKey : weekendOf(nextWeekend(l.date))[0];
    const sun = weekendOf(rowKey)[1];
    const sameMonth = rowKey.slice(0, 7) === sun.slice(0, 7);
    const row = rowsMap.get(rowKey) ?? { key: rowKey, label: sameMonth ? `${format(parseISO(rowKey), "MMM d")}–${format(parseISO(sun), "d")}` : `${format(parseISO(rowKey), "MMM d")}–${format(parseISO(sun), "MMM d")}`, sub: "", masses: [] };
    const mass: GridMass = {
      id: l.id,
      date: l.date,
      time: l.time,
      columnKey: weekend ? l.massTimeId : null,
      label: weekend ? `${format(parseISO(l.date), "EEE")} ${fmtTime(l.time)}` : `${format(parseISO(l.date), "EEE, MMM d")} · ${fmtTime(l.time)}`,
      title: l.title,
      mine: myLive ? `${myLive.p.ministry.shortName}${myLive.p.label ? ` ${myLive.p.label}` : ""}` : null,
      away: isAway(myBlackouts, l.date),
      options,
      filledOpen: { open: options.reduce((n, o) => n + o.positionIds.length, 0), total: relevant.length },
    };
    row.masses.push(mass);
    rowsMap.set(rowKey, row);
  }
  const rows = [...rowsMap.values()].sort((a, b) => a.key.localeCompare(b.key));
  const self = `/app/schedule?weeks=${weeks}`;
  const results = sp.ok?.startsWith("signed:") ? sp.ok.slice(7) : null;

  return (
    <>
      <PageTitle
        title="Sign up to serve"
        eyebrow="Open seats"
        subtitle="Tap each Mass you can serve, then press Sign up once. Green means you are already serving."
        actions={
          <div className="flex rounded-lg bg-sand p-1" role="group" aria-label="How far ahead">
            {[8, 16, 26].map((w) => (
              <Link key={w} href={`/app/schedule?weeks=${w}`} aria-current={weeks === w ? "true" : undefined} className={`inline-flex min-h-10 items-center rounded-md px-3 text-sm font-semibold ${weeks === w ? "bg-white text-navy shadow-sm" : "text-muted hover:text-ink"}`}>
                {w} weeks
              </Link>
            ))}
          </div>
        }
      />
      {sp.error && (
        <div className="mb-4">
          <Alert kind="error">{sp.error}</Alert>
        </div>
      )}
      {results && (
        <div className="mb-4">
          <Alert kind="success">{results}</Alert>
        </div>
      )}
      {sp.ok === "signed_up" && (
        <div className="mb-4">
          <Alert kind="success">You are signed up.</Alert>
        </div>
      )}
      {user.ministryIds.length === 0 && <Alert kind="warn">You are not in a ministry yet. Ask the parish office to add you.</Alert>}
      {rows.length === 0 && user.ministryIds.length > 0 && <p className="text-base text-muted">No Masses in this range.</p>}
      {rows.length > 0 && <SignupGrid columns={columns} rows={rows} returnTo={self} />}
    </>
  );
}

/** For a weekday Mass, the date of the Saturday that follows it. */
function nextWeekend(date: string) {
  const d = parseISO(date);
  const add = (6 - d.getDay() + 7) % 7;
  return format(new Date(d.getTime() + add * 86400_000), "yyyy-MM-dd");
}
