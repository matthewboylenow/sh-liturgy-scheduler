import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getMyAssignments } from "@/lib/schedule";
import { PageTitle, StatusPill } from "@/components/shell";
import { Alert, ConfirmButton } from "@/components/ui";
import { updateAssignment } from "@/app/app/actions";
import { fmtDate, fmtTime } from "@/lib/time";
import { format, parseISO } from "date-fns";

export const metadata = { title: "My schedule" };

export default async function MinePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const [upcoming, past] = await Promise.all([getMyAssignments(user.id), getMyAssignments(user.id, { past: true })]);

  return (
    <>
      <PageTitle title="My schedule" eyebrow="Your Masses" subtitle="If you cannot make it, drop or ask for a sub early." />
      {sp.error && (
        <div className="mb-4">
          <Alert kind="error">{sp.error}</Alert>
        </div>
      )}
      {sp.ok && (
        <div className="mb-4">
          <Alert kind="success">
            {sp.ok === "drop" ? "Dropped. The seat is open again." : sp.ok === "request_sub" ? "Marked as needing a sub. Your ministry has been told." : "Saved."}
          </Alert>
        </div>
      )}

      {upcoming.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-lg text-muted">Nothing scheduled.</p>
          <Link href="/app/schedule" className="btn-accent btn-lg mt-4">
            Sign up to serve
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {upcoming.map((r) => {
            const d = parseISO(r.liturgy.date);
            const role = r.position.label && !/^#\d+$/.test(r.position.label) ? r.position.label : null;
            return (
              <li key={r.assignment.id} className="card p-5">
                <div className="flex items-start gap-4">
                  <span className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-sand font-serif leading-none text-navy">
                    <span className="text-[0.7rem] font-semibold uppercase tracking-wide">{format(d, "MMM")}</span>
                    <span className="text-3xl font-bold">{format(d, "d")}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/app/liturgy/${r.liturgy.id}`} className="block font-serif text-xl font-bold text-navy hover:underline">
                      {format(d, "EEEE")} · {fmtTime(r.liturgy.time)}
                    </Link>
                    <div className="text-base text-muted">{r.liturgy.title ?? r.liturgy.location}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-base">
                      <span className="pill text-white" style={{ background: r.ministry.color }}>
                        {r.ministry.name}
                      </span>
                      {role && <span className="text-muted">{role}</span>}
                      <StatusPill status={r.assignment.status} />
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {r.assignment.status === "signed_up" && (
                    <form action={updateAssignment}>
                      <input type="hidden" name="assignmentId" value={r.assignment.id} />
                      <input type="hidden" name="action" value="confirm" />
                      <button className="btn-primary">I&apos;ll be there</button>
                    </form>
                  )}
                  {r.assignment.status !== "sub_requested" && (
                    <form action={updateAssignment}>
                      <input type="hidden" name="assignmentId" value={r.assignment.id} />
                      <input type="hidden" name="action" value="request_sub" />
                      <button className="btn-ghost">I need a sub</button>
                    </form>
                  )}
                  <form action={updateAssignment}>
                    <input type="hidden" name="assignmentId" value={r.assignment.id} />
                    <input type="hidden" name="action" value="drop" />
                    <ConfirmButton className="btn-danger" message="Drop this seat?">
                      Drop
                    </ConfirmButton>
                  </form>
                  <a href={`/app/liturgy/${r.liturgy.id}/ics`} className="btn-ghost ml-auto border-line text-muted" title="Add to calendar">
                    Add to calendar
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {past.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-base font-semibold text-navy">Past Masses ({past.length})</summary>
          <ul className="mt-3 divide-y divide-line/70 text-base">
            {past.map((r) => (
              <li key={r.assignment.id} className="flex items-center justify-between gap-3 py-2.5">
                <span>
                  {fmtDate(r.liturgy.date)} · {fmtTime(r.liturgy.time)} · {r.ministry.shortName}
                </span>
                <span className="text-sm text-muted">{r.assignment.checkedInAt ? "Checked in" : "No check-in recorded"}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
