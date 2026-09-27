import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getMyAssignments, getUpcomingPublished, liveAssignment } from "@/lib/schedule";
import { fmtDate, fmtTime } from "@/lib/time";
import { PageTitle, MinistryPill, StatusPill } from "@/components/shell";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { ministries } from "@/db/schema";
import { inArray } from "drizzle-orm";

export default async function AppHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const [mine, upcoming, myMinistries] = await Promise.all([
    getMyAssignments(user.id),
    getUpcomingPublished(6),
    user.ministryIds.length ? db.select().from(ministries).where(inArray(ministries.id, user.ministryIds)) : Promise.resolve([]),
  ]);

  // Open slots in my ministries in the next 6 weeks
  let open = 0;
  for (const l of upcoming) for (const p of l.positions) if (user.ministryIds.includes(p.ministryId) && !liveAssignment(p)) open++;

  return (
    <>
      <PageTitle title={`Hi, ${user.firstName}`} subtitle="Here is where things stand for the coming weekends." />
      {sp.welcome && (
        <div className="mb-4">
          <Alert kind="success">Your account is set up. Pick some Masses below.</Alert>
        </div>
      )}
      {sp.denied && (
        <div className="mb-4">
          <Alert kind="warn">That area is for parish staff.</Alert>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-4 md:col-span-2">
          <h2 className="mb-3 text-lg">Your next Masses</h2>
          {mine.length === 0 ? (
            <p className="text-sm text-muted">
              You are not signed up for anything yet.{" "}
              <Link href="/app/schedule" className="text-rust underline">
                See open slots
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-line/70">
              {mine.slice(0, 5).map((row) => (
                <li key={row.assignment.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div>
                    <Link href={`/app/liturgy/${row.liturgy.id}`} className="font-medium hover:underline">
                      {fmtDate(row.liturgy.date)} · {fmtTime(row.liturgy.time)}
                    </Link>
                    <div className="text-xs text-muted">
                      {row.ministry.name}
                      {row.position.label ? ` · ${row.position.label}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MinistryPill ministry={row.ministry} />
                    <StatusPill status={row.assignment.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {mine.length > 5 && (
            <Link href="/app/mine" className="mt-3 inline-block text-sm text-rust underline">
              See all {mine.length}
            </Link>
          )}
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <div className="text-3xl font-serif text-rust">{open}</div>
            <div className="text-sm text-muted">open slots in your ministries over the next six weeks</div>
            <Link href="/app/schedule" className="btn-accent mt-3 w-full">
              Sign up
            </Link>
          </div>
          <div className="card p-4">
            <h3 className="mb-2 text-sm font-semibold">Your ministries</h3>
            {myMinistries.length === 0 ? (
              <p className="text-sm text-muted">None yet. The parish office can add you.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {myMinistries.map((m) => (
                  <li key={m.id}>
                    <MinistryPill ministry={m} />
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
