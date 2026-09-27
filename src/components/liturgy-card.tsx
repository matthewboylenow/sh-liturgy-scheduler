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
  weekendTaken = false,
}: {
  liturgy: LiturgyFull;
  user: SessionUser;
  returnTo: string;
  onlyMyMinistries?: boolean;
  compact?: boolean;
  /** The viewer already holds a seat somewhere this weekend, so no sign-up buttons here. */
  weekendTaken?: boolean;
}) {
  const groups = groupByMinistry(liturgy).filter((g) => !onlyMyMinistries || user.ministryIds.includes(g.ministry.id));
  const cov = coverage(liturgy);
  const past = liturgy.startsAt < new Date();
  const servingHere = liturgy.positions.some((p) => liveAssignment(p)?.userId === user.id);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-cream/60 px-4 py-2">
        <div>
          <Link href={`/app/liturgy/${liturgy.id}`} className="font-serif text-lg text-navy hover:underline">
            {fmtDate(liturgy.date)} · {fmtTime(liturgy.time)}
          </Link>
          <div className="text-xs text-muted">
            {liturgy.title ? `${liturgy.title} · ` : ""}
            {liturgy.location}
            {servingHere && <span className="ml-2 pill bg-green-100 text-green-800">You are serving</span>}
            {!servingHere && weekendTaken && <span className="ml-2 text-muted">You are serving elsewhere this weekend</span>}
          </div>
        </div>
        <div className="text-xs text-muted">
          {cov.open === 0 ? <span className="text-green-700">Filled</span> : <span className="text-rust">{cov.open} open</span>}
          {cov.subs > 0 && <span className="ml-2 text-yellow-800">{cov.subs} need a sub</span>}
        </div>
      </div>
      {groups.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted">No slots for your ministries at this Mass.</p>
      ) : (
        <ul className="divide-y divide-line/70">
          {groups.map((g) => {
            const mine = user.ministryIds.includes(g.ministry.id);
            return (
              <li key={g.ministry.id} className="px-4 py-3">
                <div className="mb-2 flex items-center gap-2">
                  <MinistryPill ministry={g.ministry} />
                  <span className="text-sm font-medium">{g.ministry.name}</span>
                  <span className="text-xs text-muted">
                    {g.positions.filter((p) => liveAssignment(p) && liveAssignment(p)!.status !== "sub_requested").length}/{g.positions.length}
                  </span>
                </div>
                <ul className={`grid gap-1.5 ${compact ? "" : "sm:grid-cols-2"}`}>
                  {g.positions.map((p) => {
                    const a = liveAssignment(p);
                    const isMe = a?.userId === user.id;
                    const canClaim = mine && !past && liturgy.status === "published" && (!a || (a.status === "sub_requested" && !isMe)) && !servingHere && !weekendTaken;
                    return (
                      <li key={p.id} className="flex items-center justify-between gap-2 rounded border border-line/70 px-2.5 py-1.5 text-sm">
                        <div className="min-w-0">
                          {p.label && <span className="mr-1.5 text-xs text-muted">{p.label}</span>}
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
                            <SubmitButton className={a ? "btn-ghost px-2.5 py-1 text-xs" : "btn-accent px-2.5 py-1 text-xs"}>
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
