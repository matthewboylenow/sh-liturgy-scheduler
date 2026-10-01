import Link from "next/link";
import { signUp } from "@/app/app/actions";
import { SubmitButton } from "@/components/ui";
import { MinistryPill } from "@/components/shell";
import { groupByMinistry, liveAssignment, coverage, type LiturgyFull } from "@/lib/schedule";
import { fmtDate, fmtTime } from "@/lib/time";
import type { SessionUser } from "@/lib/auth";

/**
 * One Mass, with the positions the viewer can act on.
 * Volunteers only see sign-up buttons for ministries they belong to; other ministries are shown read-only
 * so everyone can see who else is serving.
 */
export function LiturgyCard({
  liturgy,
  user,
  returnTo,
  onlyMyMinistries = false,
  compact = false,
  away = false,
}: {
  liturgy: LiturgyFull;
  user: SessionUser;
  returnTo: string;
  onlyMyMinistries?: boolean;
  compact?: boolean;
  /** The viewer has a blackout covering this date, so no sign-up buttons. */
  away?: boolean;
}) {
  const groups = groupByMinistry(liturgy).filter((g) => !onlyMyMinistries || user.ministryIds.includes(g.ministry.id));
  const cov = coverage(liturgy);
  const past = liturgy.startsAt < new Date();
  const servingHere = liturgy.positions.some((p) => liveAssignment(p)?.userId === user.id);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-sand/50 px-5 py-3">
        <div>
          <Link href={`/app/liturgy/${liturgy.id}`} className="font-serif text-xl font-bold text-navy hover:underline">
            {fmtDate(liturgy.date)} · {fmtTime(liturgy.time)}
          </Link>
          <div className="text-sm text-muted">
            {liturgy.title ? `${liturgy.title} · ` : ""}
            {liturgy.location}
            {servingHere && <span className="ml-2 pill bg-green-100 text-green-800">You are serving</span>}
            {!servingHere && away && <span className="ml-2 text-muted">You are away</span>}
          </div>
        </div>
        <div className="text-sm font-semibold">
          {cov.total === 0 ? <span>No seats</span> : cov.open === 0 ? <span className="text-green-700">Filled</span> : <span className="text-rust">{cov.open} open</span>}
          {cov.subs > 0 && <span className="ml-2 text-yellow-800">{cov.subs} need a sub</span>}
        </div>
      </div>
      {groups.length === 0 ? (
        <p className="px-5 py-4 text-base text-muted">No seats for your ministries at this Mass.</p>
      ) : (
        <ul className="divide-y divide-line/70">
          {groups.map((g) => {
            const mine = user.ministryIds.includes(g.ministry.id);
            return (
              <li key={g.ministry.id} className="px-5 py-4">
                <div className="mb-2.5 flex items-center gap-2">
                  <MinistryPill ministry={g.ministry} />
                  <span className="text-base font-semibold">{g.ministry.name}</span>
                  <span className="text-sm text-muted">
                    {g.positions.filter((p) => liveAssignment(p) && liveAssignment(p)!.status !== "sub_requested").length}/{g.positions.length}
                  </span>
                </div>
                <ul className={`grid gap-2 ${compact ? "" : "sm:grid-cols-2"}`}>
                  {g.positions.map((p) => {
                    const a = liveAssignment(p);
                    const isMe = a?.userId === user.id;
                    const canClaim = mine && !past && liturgy.status === "published" && (!a || (a.status === "sub_requested" && !isMe)) && !servingHere && !away;
                    return (
                      <li key={p.id} className="flex min-h-12 items-center justify-between gap-2 rounded-lg border border-line px-3 py-1.5 text-base">
                        <div className="min-w-0">
                          {p.label && <span className="mr-1.5 text-sm text-muted">{p.label}</span>}
                          {a ? (
                            <span className={isMe ? "font-semibold text-navy" : ""}>
                              {a.user.firstName} {a.user.lastName}
                              {a.status === "sub_requested" && <span className="ml-1.5 pill bg-gold/30 text-yellow-900">needs a sub</span>}
                              {a.status === "confirmed" && <span className="ml-1.5 text-xs text-green-700">✓</span>}
                            </span>
                          ) : (
                            <span className="italic text-muted">Open</span>
                          )}
                        </div>
                        {canClaim && (
                          <form action={signUp}>
                            <input type="hidden" name="positionId" value={p.id} />
                            <input type="hidden" name="return" value={returnTo} />
                            <SubmitButton className={a ? "btn-ghost min-h-10 shrink-0 whitespace-nowrap px-3 py-1.5 text-sm" : "btn-accent min-h-10 shrink-0 whitespace-nowrap px-3 py-1.5 text-sm"}>
                              {a ? "Take it" : "Sign up"}
                            </SubmitButton>
                          </form>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
