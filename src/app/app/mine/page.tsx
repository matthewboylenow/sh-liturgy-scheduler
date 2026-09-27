import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getMyAssignments } from "@/lib/schedule";
import { PageTitle, MinistryPill, StatusPill } from "@/components/shell";
import { Alert, ConfirmButton } from "@/components/ui";
import { updateAssignment } from "@/app/app/actions";
import { fmtDate, fmtTime } from "@/lib/time";

export const metadata = { title: "My schedule" };

export default async function MinePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const [upcoming, past] = await Promise.all([getMyAssignments(user.id), getMyAssignments(user.id, { past: true })]);

  return (
    <>
      <PageTitle title="My schedule" subtitle="If you cannot make it, drop or ask for a sub early." />
      {sp.error && (
        <div className="mb-4">
          <Alert kind="error">{sp.error}</Alert>
        </div>
      )}
      {sp.ok && (
        <div className="mb-4">
          <Alert kind="success">
            {sp.ok === "drop" ? "Dropped. The slot is open again." : sp.ok === "request_sub" ? "Marked as needing a sub. Your ministry has been told." : "Saved."}
          </Alert>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Mass</th>
              <th>Ministry</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {upcoming.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-muted">
                  Nothing scheduled.{" "}
                  <Link href="/app/schedule" className="text-rust underline">
                    Sign up
                  </Link>
                </td>
              </tr>
            )}
            {upcoming.map((r) => (
              <tr key={r.assignment.id}>
                <td>
                  <Link href={`/app/liturgy/${r.liturgy.id}`} className="whitespace-nowrap font-medium hover:underline">
                    {fmtDate(r.liturgy.date)} · {fmtTime(r.liturgy.time)}
                  </Link>
                  <div className="text-xs text-muted">{r.liturgy.title ?? r.liturgy.location}</div>
                </td>
                <td>
                  <MinistryPill ministry={r.ministry} /> {r.position.label && <span className="text-xs text-muted">{r.position.label}</span>}
                </td>
                <td>
                  <StatusPill status={r.assignment.status} />
                </td>
                <td>
                  <div className="flex justify-end gap-1">
                    <a href={`/app/liturgy/${r.liturgy.id}/ics`} className="btn-ghost px-2 py-1 text-xs" title="Add to calendar">
                      .ics
                    </a>
                    {r.assignment.status === "signed_up" && (
                      <form action={updateAssignment}>
                        <input type="hidden" name="assignmentId" value={r.assignment.id} />
                        <input type="hidden" name="action" value="confirm" />
                        <button className="btn-ghost px-2 py-1 text-xs">Confirm</button>
                      </form>
                    )}
                    {r.assignment.status !== "sub_requested" && (
                      <form action={updateAssignment}>
                        <input type="hidden" name="assignmentId" value={r.assignment.id} />
                        <input type="hidden" name="action" value="request_sub" />
                        <button className="btn-ghost px-2 py-1 text-xs">Need a sub</button>
                      </form>
                    )}
                    <form action={updateAssignment}>
                      <input type="hidden" name="assignmentId" value={r.assignment.id} />
                      <input type="hidden" name="action" value="drop" />
                      <ConfirmButton className="btn-danger px-2 py-1 text-xs" message="Drop this slot?">
                        Drop
                      </ConfirmButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {past.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-muted">Past ({past.length})</summary>
          <ul className="mt-2 divide-y divide-line/70 text-sm">
            {past.map((r) => (
              <li key={r.assignment.id} className="flex items-center justify-between py-2">
                <span>
                  {fmtDate(r.liturgy.date)} · {fmtTime(r.liturgy.time)} · {r.ministry.shortName}
                </span>
                <span className="text-xs text-muted">{r.assignment.checkedInAt ? "Checked in" : "No check-in recorded"}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
