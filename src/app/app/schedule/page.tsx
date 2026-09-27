import { requireUser } from "@/lib/auth";
import { getUpcomingPublished, liveAssignment } from "@/lib/schedule";
import { PageTitle } from "@/components/shell";
import { Alert } from "@/components/ui";
import { LiturgyCard } from "@/components/liturgy-card";
import Link from "next/link";

export const metadata = { title: "Sign up" };

export default async function SchedulePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const weeks = Number(sp.weeks ?? 8);
  const onlyOpen = sp.open === "1";
  const all = await getUpcomingPublished(Number.isFinite(weeks) ? Math.min(weeks, 26) : 8);

  const list = all.filter((l) => {
    const relevant = l.positions.filter((p) => user.ministryIds.includes(p.ministryId));
    if (relevant.length === 0) return false;
    if (onlyOpen) return relevant.some((p) => !liveAssignment(p) || liveAssignment(p)!.status === "sub_requested");
    return true;
  });

  // Group by weekend (Saturday date if Sat, else the Sunday itself)
  const weekends = new Map<string, typeof list>();
  for (const l of list) {
    const d = new Date(l.date + "T12:00:00");
    const sat = new Date(d);
    if (d.getDay() === 0) sat.setDate(d.getDate() - 1);
    const key = sat.toISOString().slice(0, 10);
    weekends.set(key, [...(weekends.get(key) ?? []), l]);
  }

  const self = `/app/schedule?weeks=${weeks}${onlyOpen ? "&open=1" : ""}`;

  return (
    <>
      <PageTitle
        title="Sign up to serve"
        subtitle="Only the ministries you belong to are shown with sign-up buttons."
        actions={
          <>
            <Link href={`/app/schedule?weeks=${weeks}${onlyOpen ? "" : "&open=1"}`} className={onlyOpen ? "btn-primary" : "btn-ghost"}>
              {onlyOpen ? "Showing open only" : "Show open only"}
            </Link>
            <Link href={`/app/schedule?weeks=${weeks === 8 ? 16 : 8}${onlyOpen ? "&open=1" : ""}`} className="btn-ghost">
              {weeks === 8 ? "Next 16 weeks" : "Next 8 weeks"}
            </Link>
          </>
        }
      />
      {sp.error && (
        <div className="mb-4">
          <Alert kind="error">{sp.error}</Alert>
        </div>
      )}
      {sp.ok === "signed_up" && (
        <div className="mb-4">
          <Alert kind="success">You are signed up. Thank you.</Alert>
        </div>
      )}
      {user.ministryIds.length === 0 && <Alert kind="warn">You are not in any ministries yet, so there is nothing to sign up for. The parish office can add you.</Alert>}
      {list.length === 0 && user.ministryIds.length > 0 && <p className="text-sm text-muted">Nothing to show for this range.</p>}

      <div className="space-y-8">
        {[...weekends.entries()].map(([key, ls]) => (
          <section key={key}>
            <h2 className="mb-3 text-base font-semibold uppercase tracking-wide text-muted">Weekend of {new Date(key + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {ls.map((l) => (
                <LiturgyCard key={l.id} liturgy={l} user={user} returnTo={self} onlyMyMinistries />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
