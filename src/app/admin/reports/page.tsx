import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { coverageReport, pct } from "@/lib/reports";
import { addDaysLocal, fmtDate, todayLocal } from "@/lib/time";
import { PageTitle } from "@/components/shell";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireStaff();
  const today = todayLocal();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? sp.from! : addDaysLocal(today, -56);
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? "") ? sp.to! : addDaysLocal(today, 28);
  const r = await coverageReport(from, to);
  const scope = (name: string) => user.role === "admin" || r.ministries.some((m) => m.label === name && user.coordinatorOf.includes(m.key));
  const ministries = r.ministries.filter((m) => user.role === "admin" || user.coordinatorOf.includes(m.key));
  const people = r.people.filter((p) => p.ministries.some(scope));
  const csv = `/admin/reports/csv?from=${from}&to=${to}`;

  return (
    <>
      <PageTitle
        title="Reports"
        subtitle={`${fmtDate(from)} to ${fmtDate(to)} · ${r.masses_total} published Masses, ${r.pastMasses} already happened. No-shows count only Masses that have happened, in ministries with kiosk check-in.`}
        actions={
          <a href={csv} className="btn-ghost">
            Download CSV
          </a>
        }
      />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="label">From</label>
          <input type="date" name="from" defaultValue={from} className="input" />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" name="to" defaultValue={to} className="input" />
        </div>
        <button className="btn-ghost">Show</button>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        <Table title="By ministry" rows={ministries} />
        <Table title="By Mass time" rows={r.masses} />
      </div>

      <div className="card mt-4 overflow-x-auto">
        <div className="border-b border-line px-4 py-2 font-semibold">Who served</div>
        <table className="table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Ministries</th>
              <th className="text-right">Served</th>
              <th className="text-right">Checked in</th>
              <th className="text-right">No-shows</th>
            </tr>
          </thead>
          <tbody>
            {people.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted">
                  No sign-ups in this range.
                </td>
              </tr>
            )}
            {people.map((p) => (
              <tr key={p.userId}>
                <td>
                  <Link href={`/admin/people/${p.userId}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                  {p.tags.map((t) => (
                    <span key={t} className="ml-2 pill bg-navy/10 text-navy">
                      {t}
                    </span>
                  ))}
                </td>
                <td className="text-xs text-muted">{p.ministries.join(", ")}</td>
                <td className="text-right">{p.served}</td>
                <td className="text-right">{p.checkedIn}</td>
                <td className={`text-right ${p.noShows ? "font-semibold text-rust" : ""}`}>{p.noShows}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Table({ title, rows }: { title: string; rows: { key: string; label: string; seats: number; filled: number; checkedIn: number; noShows: number; pastFilled: number }[] }) {
  return (
    <div className="card overflow-x-auto">
      <div className="border-b border-line px-4 py-2 font-semibold">{title}</div>
      <table className="table">
        <thead>
          <tr>
            <th></th>
            <th className="text-right">Filled</th>
            <th className="text-right">Fill rate</th>
            <th className="text-right">No-shows</th>
            <th className="text-right">No-show rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.key}>
              <td className="font-medium">{m.label}</td>
              <td className="whitespace-nowrap text-right">
                {m.filled}/{m.seats}
              </td>
              <td className="text-right">{pct(m.filled, m.seats)}</td>
              <td className={`text-right ${m.noShows ? "text-rust" : ""}`}>{m.noShows}</td>
              <td className="text-right">{pct(m.noShows, m.checkedIn + m.noShows)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
