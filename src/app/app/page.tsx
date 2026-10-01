import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getMyAssignments, getUpcomingPublished, liveAssignment } from "@/lib/schedule";
import { fmtDate, fmtTime } from "@/lib/time";
import { MinistryPill, StatusPill } from "@/components/shell";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { ministries } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { format, parseISO } from "date-fns";

export default async function AppHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const [mine, upcoming, myMinistries] = await Promise.all([
    getMyAssignments(user.id),
    getUpcomingPublished(6),
    user.ministryIds.length ? db.select().from(ministries).where(inArray(ministries.id, user.ministryIds)) : Promise.resolve([]),
  ]);

  // Open seats in my ministries in the next 6 weeks
  let open = 0;
  for (const l of upcoming) for (const p of l.positions) if (user.ministryIds.includes(p.ministryId) && !liveAssignment(p)) open++;
  const next = mine[0];

  return (
    <>
      {sp.welcome && (
        <div className="mb-4">
          <Alert kind="success">Your account is ready.</Alert>
        </div>
      )}
      {sp.denied && (
        <div className="mb-4">
          <Alert kind="warn">That page is for parish staff.</Alert>
        </div>
      )}

      {/* Greeting band, in the spirit of the parish homepage hero */}
      <section className="band mb-6 overflow-hidden rounded-2xl px-6 py-8 sm:px-10 sm:py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/75">Thank you for serving</div>
            <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Hi, {user.firstName}</h1>
            <p className="mt-2 max-w-md text-base text-white/85 sm:text-lg">
              {next
                ? `Your next Mass is ${fmtDate(next.liturgy.date)} at ${fmtTime(next.liturgy.time)}.`
                : open > 0
                  ? `${open} open ${open === 1 ? "seat" : "seats"} in your ${myMinistries.length === 1 ? "ministry" : "ministries"} over the next six weeks.`
                  : "Nothing on your schedule yet."}
            </p>
          </div>
          <Link href="/app/schedule" className="btn-accent btn-lg w-full shrink-0 md:w-auto">
            Sign up to serve
          </Link>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3 md:items-start">
        <div className="card p-5 md:col-span-2 sm:p-6">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-xl font-bold text-navy">Your next Masses</h2>
            {mine.length > 0 && (
              <Link href="/app/mine" className="text-base font-semibold text-rust underline-offset-4 hover:underline">
                My schedule
              </Link>
            )}
          </div>
          {mine.length === 0 ? (
            <p className="text-base text-muted">
              You are not signed up for anything yet.{" "}
              <Link href="/app/schedule" className="font-semibold text-rust underline">
                See open seats
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-line/70">
              {mine.slice(0, 5).map((row) => {
                const d = parseISO(row.liturgy.date);
                return (
                  <li key={row.assignment.id}>
                    <Link href={`/app/liturgy/${row.liturgy.id}`} className="-mx-2 flex items-center gap-4 rounded-lg px-2 py-3 hover:bg-cream">
                      <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-sand font-serif leading-none text-navy">
                        <span className="text-[0.65rem] font-semibold uppercase tracking-wide">{format(d, "MMM")}</span>
                        <span className="text-2xl font-bold">{format(d, "d")}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-semibold">
                          {format(d, "EEEE")} · {fmtTime(row.liturgy.time)}
                        </span>
                        <span className="block text-sm text-muted">
                          {row.ministry.name}
                          {row.position.label && !/^#\d+$/.test(row.position.label) ? ` · ${row.position.label}` : ""}
                        </span>
                      </span>
                      <span className="hidden items-center gap-2 sm:flex">
                        <MinistryPill ministry={row.ministry} />
                        <StatusPill status={row.assignment.status} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1">
          <Link href="/app/schedule" className="card block p-5 transition hover:-translate-y-0.5">
            <div className="eyebrow">Open seats</div>
            <div className="mt-1 font-serif text-4xl font-bold text-navy">{open}</div>
            <div className="mt-1 text-base text-muted">in your {myMinistries.length === 1 ? "ministry" : "ministries"}, next six weeks</div>
          </Link>
          <div className="card p-5">
            <div className="eyebrow">Your ministries</div>
            {myMinistries.length === 0 ? (
              <p className="mt-2 text-base text-muted">None yet. Ask the parish office to add you.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {myMinistries.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-base">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: m.color }} />
                    {m.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
