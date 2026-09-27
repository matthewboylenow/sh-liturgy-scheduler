import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getLiturgies, coverage } from "@/lib/schedule";
import { addDaysLocal, fmtDate, fmtTime, todayLocal } from "@/lib/time";
import { PageTitle, StatusPill } from "@/components/shell";
import { Flash } from "@/components/flash";
import { SubmitButton } from "@/components/ui";
import { createOneLiturgy, generateLiturgies, setLiturgyStatus } from "@/app/admin/actions";

export const metadata = { title: "Schedule" };

export default async function SchedulePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireStaff();
  const admin = user.role === "admin";
  const today = todayLocal();
  const from = sp.from ?? today;
  const to = sp.to ?? addDaysLocal(from, 42);
  const statuses = sp.status ? [sp.status as "draft" | "published" | "cancelled"] : undefined;
  const list = await getLiturgies({ from, to, statuses });
  const self = `/admin/schedule?from=${from}&to=${to}${sp.status ? `&status=${sp.status}` : ""}`;

  return (
    <>
      <PageTitle
        title="Schedule"
        subtitle="Volunteers see published Masses only."
        actions={
          admin && (
            <Link href="/admin/schedule/presiders" className="btn-ghost">
              Presider schedule
            </Link>
          )
        }
      />
      <Flash sp={sp} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <form method="get" className="mb-3 flex flex-wrap items-end gap-2">
            <div>
              <label className="label">From</label>
              <input type="date" name="from" defaultValue={from} className="input" />
            </div>
            <div>
              <label className="label">To</label>
              <input type="date" name="to" defaultValue={to} className="input" />
            </div>
            <div>
              <label className="label">Status</label>
              <select name="status" defaultValue={sp.status ?? ""} className="input">
                <option value="">Any</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <button className="btn-ghost">Show</button>
          </form>

          <form action={setLiturgyStatus} className="card overflow-x-auto">
            <input type="hidden" name="return" value={self} />
            <table className="table">
              <thead>
                <tr>
                  {admin && <th></th>}
                  <th>Mass</th>
                  <th>Coverage</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((l) => {
                  const c = coverage(l);
                  return (
                    <tr key={l.id} className={l.status === "cancelled" ? "opacity-50" : ""}>
                      {admin && (
                        <td>
                          <input type="checkbox" name="ids" value={l.id} />
                        </td>
                      )}
                      <td>
                        <Link href={`/admin/schedule/${l.id}`} className="whitespace-nowrap font-medium hover:underline">
                          {fmtDate(l.date)} · {fmtTime(l.time)}
                        </Link>
                        <div className="text-xs text-muted">
                          {l.title ? `${l.title} · ` : ""}
                          {l.location}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-28 overflow-hidden rounded bg-line">
                            <div className={`h-full ${c.open === 0 ? "bg-green-600" : "bg-rust"}`} style={{ width: `${c.total ? (c.filled / c.total) * 100 : 0}%` }} />
                          </div>
                          <span className="text-xs text-muted">
                            {c.filled}/{c.total}
                            {c.subs ? ` · ${c.subs} sub` : ""}
                          </span>
                        </div>
                      </td>
                      <td>
                        <StatusPill status={l.status} />
                      </td>
                    </tr>
                  );
                })}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted">
                      No Masses in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {admin && list.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-t border-line p-3 text-sm">
                <span className="text-muted">With selected:</span>
                <button name="status" value="published" className="btn-primary px-3 py-1 text-xs">
                  Publish
                </button>
                <button name="status" value="draft" className="btn-ghost px-3 py-1 text-xs">
                  Back to draft
                </button>
                <button name="status" value="cancelled" className="btn-danger px-3 py-1 text-xs">
                  Cancel
                </button>
              </div>
            )}
          </form>
        </div>

        {admin && (
          <div className="space-y-4">
            <form action={generateLiturgies} className="card space-y-3 p-4">
              <h2 className="text-lg">Generate from the weekly pattern</h2>
              <p className="text-xs text-muted">One Mass per active Mass time per date. Dates that already have that Mass are skipped.</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">From</label>
                  <input type="date" name="from" defaultValue={today} className="input" required />
                </div>
                <div>
                  <label className="label">To</label>
                  <input type="date" name="to" defaultValue={addDaysLocal(today, 90)} className="input" required />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="publish" /> Publish right away
              </label>
              <SubmitButton pendingText="Generating">Generate</SubmitButton>
            </form>

            <form action={createOneLiturgy} className="card space-y-3 p-4">
              <h2 className="text-lg">Add a single Mass</h2>
              <p className="text-xs text-muted">For holy days, Christmas, funerals. Positions are added on the next screen.</p>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" name="date" className="input" required />
                <input type="time" name="time" className="input" required />
              </div>
              <input name="title" className="input" placeholder="Title" aria-label="Title" />
              <input name="location" className="input" placeholder="Location" defaultValue="Church" />
              <SubmitButton className="btn-ghost">Add Mass</SubmitButton>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
