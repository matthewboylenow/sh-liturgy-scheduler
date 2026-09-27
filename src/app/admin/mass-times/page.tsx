import { asc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/db";
import { massTimes, ministries, positionTemplates } from "@/db/schema";
import { PageTitle, MinistryPill } from "@/components/shell";
import { Flash } from "@/components/flash";
import { SubmitButton } from "@/components/ui";
import { saveMassTime, saveTemplates, toggleMassTime } from "@/app/admin/actions";
import { DAY_NAMES } from "@/lib/time";

export const metadata = { title: "Mass times" };

const COUNTS = Array.from({ length: 13 }, (_, i) => i);

export default async function MassTimesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await requireAdmin();
  const [times, mins, templates] = await Promise.all([
    db.select().from(massTimes).orderBy(asc(massTimes.sortOrder), asc(massTimes.dayOfWeek), asc(massTimes.time)),
    db.select().from(ministries).where(eq(ministries.active, true)).orderBy(asc(ministries.sortOrder)),
    db.select().from(positionTemplates),
  ]);
  const tmap = new Map(templates.map((t) => [`${t.massTimeId}:${t.ministryId}:${t.role}`, t.count]));
  const rolesOf = (m: { roles: string[] }) => (m.roles.length ? m.roles : [""]);
  const editing = sp.edit ? times.find((t) => t.id === sp.edit) : null;

  return (
    <>
      <PageTitle title="Mass times" subtitle="How many of each ministry every Mass needs." />
      <Flash sp={sp} />

      <div className="space-y-4">
        <div>
          <form action={saveTemplates} className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Mass</th>
                  {mins.map((m) => (
                    <th key={m.id} className="text-center">
                      <MinistryPill ministry={m} />
                    </th>
                  ))}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {times.map((t) => (
                  <tr key={t.id} className={t.active ? "" : "opacity-50"}>
                    <td className="whitespace-nowrap">
                      <div className="font-medium">{t.label}</div>
                      {(t.location !== "Church" || !t.active) && (
                        <div className="text-xs text-muted">
                          {t.location !== "Church" && t.location}
                          {!t.active && " inactive"}
                        </div>
                      )}
                    </td>
                    {mins.map((m) => (
                      <td key={m.id} className="px-1 text-center align-top">
                        <div className="inline-grid gap-1">
                          {rolesOf(m).map((role) => (
                            <label key={role} className="flex items-center justify-between gap-1.5 text-xs text-muted">
                              {role && <span className="whitespace-nowrap">{role}</span>}
                              <select
                                name={`count:${t.id}:${m.id}:${encodeURIComponent(role)}`}
                                defaultValue={tmap.get(`${t.id}:${m.id}:${role}`) ?? 0}
                                className="input min-w-14 w-14 px-1 py-1.5 text-center"
                                aria-label={`${role ? `${m.shortName} ${role}` : m.shortName} at ${t.label}`}
                              >
                                {COUNTS.map((n) => (
                                  <option key={n} value={n}>
                                    {n}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ))}
                        </div>
                      </td>
                    ))}
                    <td className="align-top">
                      <div className="flex justify-end gap-1">
                        <a href={`/admin/mass-times?edit=${t.id}`} className="btn-ghost px-2 py-1 text-xs">
                          Edit
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
                {times.length === 0 && (
                  <tr>
                    <td colSpan={mins.length + 2} className="py-6 text-center text-muted">
                      No Mass times yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {times.length > 0 && mins.length > 0 && (
              <div className="border-t border-line p-3">
                <SubmitButton>Save position counts</SubmitButton>
              </div>
            )}
          </form>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <form action={saveMassTime} className="card space-y-3 p-4" key={editing?.id ?? "new"}>
            <h2 className="text-lg">{editing ? "Edit Mass time" : "Add a Mass time"}</h2>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Day</label>
                <select name="dayOfWeek" className="input" defaultValue={editing?.dayOfWeek ?? 0}>
                  {DAY_NAMES.map((d, i) => (
                    <option key={i} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Time</label>
                <input name="time" type="time" className="input" defaultValue={editing?.time ?? "10:30"} required />
              </div>
            </div>
            <div>
              <label className="label">Label (optional)</label>
              <input name="label" className="input" defaultValue={editing?.label} />
            </div>
            <div>
              <label className="label">Location</label>
              <input name="location" className="input" defaultValue={editing?.location ?? "Church"} />
            </div>
            <div className="flex gap-2">
              <SubmitButton>{editing ? "Save" : "Add"}</SubmitButton>
              {editing && (
                <a href="/admin/mass-times" className="btn-ghost">
                  Cancel
                </a>
              )}
            </div>
          </form>
          {editing && (
            <form action={toggleMassTime} className="card p-4">
              <input type="hidden" name="id" value={editing.id} />
              <p className="mb-2 text-xs text-muted">Inactive Mass times are skipped when generating. Existing Masses stay.</p>
              <button className="btn-ghost">{editing.active ? "Mark inactive" : "Mark active"}</button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
