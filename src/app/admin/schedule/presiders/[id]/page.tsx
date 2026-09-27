import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/db";
import { presiderImports } from "@/db/schema";
import { presiderCandidates } from "@/lib/presiders";
import { PageTitle } from "@/components/shell";
import { Flash } from "@/components/flash";
import { Alert, ConfirmButton, SubmitButton } from "@/components/ui";
import { confirmPresiderImport, discardPresiderImport } from "@/app/admin/actions";
import { fmtDate, fmtTime } from "@/lib/time";

export default async function PresiderImportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  await requireAdmin();
  const [imp] = await db.select().from(presiderImports).where(eq(presiderImports.id, id));
  if (!imp) notFound();
  const { legend, rows, skipped } = imp.payload;
  const candidates = await presiderCandidates();
  const byInitials = new Map(candidates.filter((c) => c.initials).map((c) => [c.initials!, c]));
  const initialsList = [...new Set(rows.map((r) => r.initials))].sort();

  // Default choice per initials: someone already carrying them, else a name match against the legend, else create.
  const defaultFor = (ini: string) => {
    const known = byInitials.get(ini);
    if (known) return known.id;
    const name = legend[ini];
    if (name) {
      const last = name.trim().split(/\s+/).pop()!.toLowerCase();
      const hit = candidates.find((c) => c.lastName.toLowerCase() === last);
      if (hit) return hit.id;
      return "new";
    }
    return "";
  };
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.initials, (counts.get(r.initials) ?? 0) + 1);

  return (
    <>
      <PageTitle
        title={imp.fileName}
        subtitle={`${rows.length} weekend Masses, ${rows[0] ? `${fmtDate(rows[0].date)} to ${fmtDate(rows.at(-1)!.date)}` : ""}`}
        actions={
          <Link href="/admin/schedule/presiders" className="btn-ghost">
            All uploads
          </Link>
        }
      />
      <Flash sp={sp} />
      {imp.appliedAt && (
        <div className="mb-4">
          <Alert kind="success">Applied. {imp.summary}</Alert>
        </div>
      )}

      <form action={confirmPresiderImport} className="grid gap-4 lg:grid-cols-3">
        <input type="hidden" name="id" value={imp.id} />
        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="mb-1 text-lg">Who is who</h2>
            <p className="mb-3 text-xs text-muted">Initials from the PDF and the person they mean. Choices are remembered for the next upload.</p>
            <div className="space-y-3">
              {initialsList.map((ini) => (
                <div key={ini}>
                  <label className="label">
                    <span className="font-mono">{ini}</span>
                    <span className="ml-2 font-normal text-muted">
                      {legend[ini] ?? "not in the legend"} · {counts.get(ini)} Mass{counts.get(ini) === 1 ? "" : "es"}
                    </span>
                  </label>
                  <select name={`map:${ini}`} className="input" defaultValue={defaultFor(ini)} required disabled={!!imp.appliedAt}>
                    <option value="" disabled>
                      Choose
                    </option>
                    {legend[ini] && <option value="new">Add {legend[ini]}</option>}
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                        {c.initials ? ` (${c.initials})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
          {!imp.appliedAt && (
            <div className="card space-y-3 p-4">
              <p className="text-xs text-muted">Masses in this range that do not exist yet are created as drafts. Existing sign-ups are not touched; only the presider seat changes.</p>
              <SubmitButton pendingText="Applying">Apply to the schedule</SubmitButton>
            </div>
          )}
        </div>

        <div className="card lg:col-span-2 self-start overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Mass</th>
                <th>Sunday</th>
                <th>Presider</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.date}${r.time}`}>
                  <td className="whitespace-nowrap font-medium">
                    {fmtDate(r.date)} · {fmtTime(r.time)}
                  </td>
                  <td className="text-xs text-muted">{r.sundayName}</td>
                  <td>
                    <span className="font-mono">{r.initials}</span> <span className="text-xs text-muted">{legend[r.initials] ?? ""}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {skipped.length > 0 && (
            <details className="border-t border-line px-4 py-2 text-xs text-muted">
              <summary className="cursor-pointer">{skipped.length} lines ignored (weekday Masses and anything that does not match the weekend pattern)</summary>
              <ul className="mt-2 columns-2 sm:columns-3">
                {skipped.map((s, i) => (
                  <li key={i}>
                    {s.date} {s.time} {s.initials} · {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </form>
      {!imp.appliedAt && (
        <form action={discardPresiderImport} className="mt-4">
          <input type="hidden" name="id" value={imp.id} />
          <ConfirmButton className="btn-ghost text-xs" message="Discard this upload?">
            Discard
          </ConfirmButton>
        </form>
      )}
    </>
  );
}
