"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { signUpMany } from "@/app/app/actions";

/** One kind of open seat at a Mass for the viewer: a ministry, or a ministry role. */
export type SeatOption = { key: string; ministryShort: string; ministryName: string; role: string | null; positionIds: string[] };
export type GridMass = {
  id: string;
  date: string;
  time: string;
  columnKey: string | null; // Mass time id, or null for a Mass outside the weekly pattern
  label: string; // "Sat 5:00 PM" / "Christmas Eve 4:00 PM"
  title: string | null;
  mine: string | null; // "EM #2" when the viewer already holds a seat here
  away: boolean;
  options: SeatOption[];
  filledOpen: { open: number; total: number }; // across the viewer's ministries
};
export type GridRow = { key: string; label: string; sub: string; masses: GridMass[] };
export type GridColumn = { key: string; label: string };

type Pick = { massId: string; positionId: string; label: string };

/**
 * Weekends down, Mass times across. Tap a cell to pick a seat, tap several, then one Sign up.
 * A Mass with exactly one kind of open seat is chosen with a single tap; otherwise a small sheet asks which.
 */
export function SignupGrid({ columns, rows, returnTo }: { columns: GridColumn[]; rows: GridRow[]; returnTo: string }) {
  const [picks, setPicks] = useState<Map<string, Pick>>(new Map());
  const [sheet, setSheet] = useState<GridMass | null>(null);

  const massById = useMemo(() => new Map(rows.flatMap((r) => r.masses).map((m) => [m.id, m])), [rows]);

  function toggle(m: GridMass) {
    if (picks.has(m.id)) {
      const next = new Map(picks);
      next.delete(m.id);
      setPicks(next);
      return;
    }
    if (m.options.length === 1) choose(m, m.options[0]);
    else setSheet(m);
  }
  function choose(m: GridMass, opt: SeatOption) {
    const next = new Map(picks);
    next.set(m.id, { massId: m.id, positionId: opt.positionIds[0], label: opt.role ? `${opt.ministryShort} ${opt.role}` : opt.ministryShort });
    setPicks(next);
    setSheet(null);
  }

  const count = picks.size;

  return (
    <form action={signUpMany} className="pb-28">
      <input type="hidden" name="return" value={returnTo} />
      {[...picks.values()].map((p) => (
        <input key={p.positionId} type="hidden" name="positionId" value={p.positionId} />
      ))}

      <div className="card overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-base">
          <thead>
            <tr className="border-b border-line bg-sand/60 text-xs font-semibold uppercase tracking-wide text-navy sm:text-sm">
              <th className="w-[4.6rem] px-2 py-3 text-left sm:w-32">Weekend</th>
              {columns.map((c) => (
                <th key={c.key} className="px-1 py-3 text-center">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const extras = r.masses.filter((m) => !m.columnKey || !columns.some((c) => c.key === m.columnKey));
              return (
                <RowGroup key={r.key} row={r} columns={columns} extras={extras} picks={picks} onToggle={toggle} />
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
        <span className="inline-flex items-center gap-2"><span className="inline-block h-4 w-4 rounded border-2 border-rust" /> open</span>
        <span className="inline-flex items-center gap-2"><span className="inline-block h-4 w-4 rounded bg-rust" /> picked</span>
        <span className="inline-flex items-center gap-2"><span className="inline-block h-4 w-4 rounded bg-green-700" /> you are serving</span>
        <span className="inline-flex items-center gap-2"><span className="inline-block h-4 w-4 rounded bg-sand" /> full or away</span>
      </p>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-40 border-t border-line bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,.08)] backdrop-blur md:bottom-0">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="min-w-0 text-base">
              <div className="font-semibold text-navy">
                {count} Mass{count === 1 ? "" : "es"} picked
              </div>
              <div className="truncate text-sm text-muted">
                {[...picks.values()]
                  .map((p) => {
                    const m = massById.get(p.massId)!;
                    return `${m.label} ${p.label}`;
                  })
                  .join(" · ")}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => setPicks(new Map())} className="btn-ghost">
                Clear
              </button>
              <button type="submit" className="btn-accent btn-lg">
                Sign up
              </button>
            </div>
          </div>
        </div>
      )}

      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setSheet(null)}>
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4">
              <div className="eyebrow">Which seat?</div>
              <div className="font-serif text-2xl font-bold text-navy">{sheet.label}</div>
              {sheet.title && <div className="text-base text-muted">{sheet.title}</div>}
            </div>
            <div className="grid gap-2">
              {sheet.options.map((o) => (
                <button key={o.key} type="button" onClick={() => choose(sheet, o)} className="flex min-h-14 items-center justify-between rounded-lg border-2 border-line px-4 py-3 text-left text-base hover:border-navy hover:bg-cream">
                  <span>
                    <span className="font-semibold">{o.ministryName}</span>
                    {o.role && <span className="text-muted"> · {o.role}</span>}
                  </span>
                  <span className="text-sm font-semibold text-rust">
                    {o.positionIds.length} open
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between text-base">
              <Link href={`/app/liturgy/${sheet.id}`} className="min-h-11 inline-flex items-center text-navy underline underline-offset-4">
                Who else is serving
              </Link>
              <button type="button" onClick={() => setSheet(null)} className="btn-ghost">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

function RowGroup({ row, columns, extras, picks, onToggle }: { row: GridRow; columns: GridColumn[]; extras: GridMass[]; picks: Map<string, Pick>; onToggle: (m: GridMass) => void }) {
  return (
    <>
      <tr className="border-b border-line/70 align-top">
        <th scope="row" className="px-2 py-2 text-left">
          <div className="font-serif text-base font-bold text-navy sm:text-lg">{row.label}</div>
          {row.sub && <div className="text-sm font-normal text-muted">{row.sub}</div>}
        </th>
        {columns.map((c) => {
          const m = row.masses.find((x) => x.columnKey === c.key);
          return (
            <td key={c.key} className="px-1 py-2 text-center">
              {m ? <Cell m={m} pick={picks.get(m.id)} onToggle={onToggle} /> : <span className="text-line">·</span>}
            </td>
          );
        })}
      </tr>
      {extras.map((m) => (
        <tr key={m.id} className="border-b border-line/70">
          <th scope="row" className="px-2 py-2 text-left text-sm font-normal text-muted">
            {m.label}
          </th>
          <td colSpan={columns.length} className="px-1 py-2 text-left">
            <div className="flex items-center gap-2">
              <Cell m={m} pick={picks.get(m.id)} onToggle={onToggle} />
              {m.title && <span className="text-sm text-muted">{m.title}</span>}
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

function Cell({ m, pick, onToggle }: { m: GridMass; pick?: Pick; onToggle: (m: GridMass) => void }) {
  const base = "mx-auto flex h-14 w-full max-w-[6rem] flex-col items-center justify-center rounded-lg text-sm leading-tight transition sm:h-16 sm:text-base";
  if (m.mine) {
    return (
      <Link href={`/app/liturgy/${m.id}`} className={`${base} bg-green-700 text-white`} title="You are serving at this Mass">
        <span className="font-semibold">You</span>
        <span className="opacity-90">{m.mine}</span>
      </Link>
    );
  }
  if (m.away) return <div className={`${base} bg-sand text-muted`} title="You are away">away</div>;
  if (m.options.length === 0) return <div className={`${base} bg-sand text-muted`} title="No open seats in your ministries">full</div>;
  if (pick) {
    return (
      <button type="button" onClick={() => onToggle(m)} className={`${base} bg-rust text-white shadow-[inset_0_0_0_2px_rgba(255,255,255,.35)]`} aria-pressed="true">
        <span className="text-lg font-bold leading-none">✓</span>
        <span>{pick.label}</span>
      </button>
    );
  }
  return (
    <button type="button" onClick={() => onToggle(m)} className={`${base} border-2 border-rust bg-white text-rust hover:bg-rust/10`} aria-pressed="false">
      <span className="font-bold">{m.filledOpen.open} open</span>
      {m.options.length === 1 && <span className="text-xs sm:text-sm">{m.options[0].ministryShort}</span>}
    </button>
  );
}
