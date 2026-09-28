import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getLiturgies, groupByMinistry, liveAssignment } from "@/lib/schedule";
import { addDaysLocal, fmtDateLong, fmtTime, todayLocal, weekendOf } from "@/lib/time";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Weekend sheet" };

/** Letter portrait, black on white, one Mass per block. For the sacristy wall and people without phones. */
export default async function PrintPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await requireStaff();
  const [satDefault] = weekendOf(todayLocal());
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? sp.from! : satDefault;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? "") ? sp.to! : addDaysLocal(from, 1);
  const list = await getLiturgies({ from, to, statuses: ["published"] });

  return (
    <main className="print-sheet mx-auto max-w-[8.5in] bg-white px-8 py-6 text-black">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 print:hidden">
        <form method="get" className="flex flex-wrap items-end gap-2 text-sm">
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
        <div className="flex gap-2">
          <Link href="/admin/schedule" className="btn-ghost">
            Schedule
          </Link>
          <PrintButton />
        </div>
      </div>

      <header className="mb-4 border-b-2 border-black pb-2">
        <h1 className="font-serif text-2xl">Saint Helen Liturgy Scheduler</h1>
        <p className="text-sm">
          Ministry schedule, {fmtDateLong(from)}
          {to !== from ? ` to ${fmtDateLong(to)}` : ""}
        </p>
      </header>

      {list.length === 0 && <p className="text-sm">No published Masses in this range.</p>}

      {list.map((l) => (
        <section key={l.id} className="mass-block mb-5 break-inside-avoid">
          <h2 className="mb-1 border-b border-black font-serif text-lg">
            {fmtDateLong(l.date)} · {fmtTime(l.time)}
            {l.title && <span className="font-sans text-sm"> · {l.title}</span>}
            {l.location !== "Church" && <span className="font-sans text-sm"> · {l.location}</span>}
          </h2>
          {l.notes && <p className="mb-1 text-sm italic">{l.notes}</p>}
          <table className="w-full text-sm">
            <tbody>
              {groupByMinistry(l).map((g) => (
                <tr key={g.ministry.id} className="align-top">
                  <th className="w-36 py-0.5 pr-3 text-left font-semibold">{g.ministry.name}</th>
                  <td className="py-0.5">
                    <ul className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
                      {g.positions.map((p) => {
                        const a = liveAssignment(p);
                        const open = !a || a.status === "sub_requested";
                        return (
                          <li key={p.id} className="flex items-baseline gap-2">
                            {p.label && <span className="w-16 shrink-0 text-xs text-neutral-600">{p.label}</span>}
                            {a && !open ? (
                              <span>
                                {a.user.firstName} {a.user.lastName}
                              </span>
                            ) : (
                              <span className="flex-1">
                                {a && <span className="text-xs text-neutral-600">{a.user.firstName} {a.user.lastName}, needs a sub: </span>}
                                <span className="inline-block w-40 border-b border-black align-baseline">&nbsp;</span>
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <footer className="mt-6 text-xs text-neutral-600">Printed {fmtDateLong(todayLocal())}. Blank lines are open seats.</footer>
    </main>
  );
}
