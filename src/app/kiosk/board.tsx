"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { KioskMass } from "@/lib/kiosk";

type Today = { date: string; masses: KioskMass[]; now: string; kiosk: { name: string } };
type Slot = KioskMass["ministries"][number]["slots"][number];

function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export function KioskBoard({ kioskName, parish }: { kioskName: string; parish: string }) {
  const [data, setData] = useState<Today | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null); // liturgy id
  const [confirm, setConfirm] = useState<{ slot: Slot; ministry: string } | null>(null);
  const [fill, setFill] = useState<{ slot: Slot; ministryId: string; ministry: string } | null>(null);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [toast, setToast] = useState<{ text: string; undo?: string } | null>(null);
  const [clock, setClock] = useState(new Date());

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/kiosk/today", { cache: "no-store" });
      if (!r.ok) throw new Error(r.status === 401 ? "This screen is no longer authorized." : "Could not load today's schedule.");
      setData(await r.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 20_000);
    const c = setInterval(() => setClock(new Date()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
      clearInterval(c);
    };
  }, [load]);

  // Pick the "current" Mass: the first one that hasn't ended (start + 90 min), else the last one
  const currentId = useMemo(() => {
    if (!data?.masses.length) return null;
    const now = new Date(data.now).getTime();
    const live = data.masses.find((m) => new Date(m.startsAt).getTime() + 90 * 60_000 > now);
    return (live ?? data.masses[data.masses.length - 1]).id;
  }, [data]);
  const activeId = selected ?? currentId;
  const mass = data?.masses.find((m) => m.id === activeId) ?? null;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  async function checkIn(slot: Slot) {
    if (!slot.assignmentId) return;
    setConfirm(null);
    const r = await fetch("/api/kiosk/checkin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assignmentId: slot.assignmentId }) });
    if (r.ok) setToast({ text: `${slot.name} checked in.`, undo: slot.assignmentId });
    else setToast({ text: (await r.json()).error ?? "That did not go through." });
    load();
  }
  async function undo(assignmentId: string) {
    setToast(null);
    await fetch("/api/kiosk/checkin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assignmentId, undo: true }) });
    load();
  }
  async function openFill(slot: Slot, ministryId: string, ministry: string) {
    setFill({ slot, ministryId, ministry });
    setMembers([]);
    const r = await fetch(`/api/kiosk/fill?ministryId=${ministryId}`);
    if (r.ok) setMembers((await r.json()).members);
  }
  async function doFill(userId: string, name: string) {
    if (!fill) return;
    const r = await fetch("/api/kiosk/fill", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ positionId: fill.slot.positionId, userId }) });
    setFill(null);
    if (r.ok) setToast({ text: `${name} checked in as a fill-in.` });
    else setToast({ text: (await r.json()).error ?? "Could not fill that slot." });
    load();
  }

  const totals = mass
    ? mass.ministries.reduce(
        (acc, m) => {
          for (const s of m.slots) {
            acc.total++;
            if (s.checkedInAt) acc.here++;
            else if (!s.assignmentId || s.status === "sub_requested") acc.open++;
          }
          return acc;
        },
        { total: 0, here: 0, open: 0 },
      )
    : null;

  return (
    <main className="kiosk flex min-h-full flex-1 flex-col bg-navy text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-3">
        <div>
          <div className="font-serif text-2xl">{parish} · Ministry check-in</div>
          <div className="text-sm text-white/60">
            {clock.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · {kioskName}
          </div>
        </div>
        <div className="font-serif text-4xl tabular-nums">{clock.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</div>
      </header>

      {error && <div className="bg-rust px-6 py-2 text-sm">{error}</div>}

      {data && data.masses.length === 0 && (
        <div className="flex flex-1 items-center justify-center p-10 text-center">
          <div>
            <div className="font-serif text-3xl">No Masses today</div>
            <p className="mt-2 text-white/60">Today&apos;s published Masses appear here.</p>
          </div>
        </div>
      )}

      {data && data.masses.length > 0 && (
        <>
          <nav className="flex gap-2 overflow-x-auto px-6 py-3">
            {data.masses.map((m) => {
              const active = m.id === activeId;
              const here = m.ministries.reduce((n, g) => n + g.slots.filter((s) => s.checkedInAt).length, 0);
              const total = m.ministries.reduce((n, g) => n + g.slots.length, 0);
              return (
                <button
                  key={m.id}
                  onClick={() => setSelected(m.id)}
                  className={`shrink-0 rounded-xl px-5 py-3 text-left transition ${active ? "bg-white text-navy" : "bg-white/10 hover:bg-white/20"}`}
                >
                  <div className="text-xl font-semibold">{fmtTime(m.time)}</div>
                  <div className={`text-xs ${active ? "text-navy/60" : "text-white/60"}`}>
                    {m.title ?? m.location} · {here}/{total} here
                  </div>
                </button>
              );
            })}
          </nav>

          {mass && (
            <section className="flex-1 overflow-y-auto px-6 pb-24">
              <div className="mb-3 flex items-baseline justify-between">
                <h1 className="font-serif text-3xl">
                  {fmtTime(mass.time)} {mass.title && <span className="text-white/70">· {mass.title}</span>}
                </h1>
                {totals && (
                  <div className="text-sm text-white/70">
                    <span className="text-green-300">{totals.here} here</span> · {totals.total - totals.here - totals.open} expected · <span className={totals.open ? "text-gold" : ""}>{totals.open} open</span>
                  </div>
                )}
              </div>
              {mass.notes && <div className="mb-4 rounded-lg bg-gold/20 px-4 py-2 text-gold">{mass.notes}</div>}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {mass.ministries.map((g) => (
                  <div key={g.id} className="rounded-xl bg-white/5 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: g.color }} />
                      <span className="font-semibold">{g.name}</span>
                      <span className="ml-auto text-xs text-white/50">
                        {g.slots.filter((s) => s.checkedInAt).length}/{g.slots.length}
                      </span>
                    </div>
                    <div className="grid gap-2">
                      {g.slots.map((s) => {
                        const here = !!s.checkedInAt;
                        const open = !s.assignmentId || s.status === "sub_requested";
                        return (
                          <button
                            key={s.positionId}
                            disabled={here}
                            onClick={() => (open ? openFill(s, g.id, g.shortName) : setConfirm({ slot: s, ministry: g.name }))}
                            className={`flex min-h-[4.25rem] items-center justify-between rounded-lg px-4 py-3 text-left text-lg transition ${
                              here ? "bg-green-500/90 text-white" : open ? "border-2 border-dashed border-gold/60 text-gold hover:bg-gold/10" : "bg-white text-navy hover:bg-cream active:scale-[0.99]"
                            }`}
                          >
                            <span>
                              {s.label && <span className={`mr-2 text-xs ${here ? "text-white/70" : "text-navy/50"}`}>{s.label}</span>}
                              {s.name ?? "Open. Tap to fill in"}
                              {s.status === "sub_requested" && s.name && <span className="ml-2 text-sm">(needs a sub. Tap to cover)</span>}
                            </span>
                            <span className="text-sm">{here ? "✓ Here" : open ? "" : "Tap to check in"}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {confirm && (
        <Modal onClose={() => setConfirm(null)}>
          <div className="text-center">
            <div className="text-sm uppercase tracking-wide text-navy/60">{confirm.ministry}</div>
            <div className="my-3 font-serif text-4xl text-navy">{confirm.slot.name}</div>
            <p className="mb-6 text-navy/70">Check in for {mass ? fmtTime(mass.time) : "this Mass"}?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(null)} className="flex-1 rounded-xl border border-line py-4 text-xl text-navy">
                Not me
              </button>
              <button onClick={() => checkIn(confirm.slot)} className="flex-1 rounded-xl bg-navy py-4 text-xl text-white">
                Yes, I&apos;m here
              </button>
            </div>
          </div>
        </Modal>
      )}

      {fill && (
        <Modal onClose={() => setFill(null)}>
          <div className="mb-3 text-center">
            <div className="text-sm uppercase tracking-wide text-navy/60">Filling in · {fill.ministry}</div>
            <div className="font-serif text-2xl text-navy">Who is covering this slot?</div>
          </div>
          {members.length === 0 ? (
            <p className="py-6 text-center text-navy/60">Loading</p>
          ) : (
            <div className="grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
              {members.map((m) => (
                <button key={m.id} onClick={() => doFill(m.id, m.name)} className="rounded-lg bg-cream px-3 py-3 text-left text-navy hover:bg-gold/30">
                  {m.name}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setFill(null)} className="mt-4 w-full rounded-xl border border-line py-3 text-navy">
            Cancel
          </button>
        </Modal>
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-0 flex justify-center p-4">
          <div className="flex items-center gap-4 rounded-full bg-white px-6 py-3 text-lg text-navy shadow-lg">
            {toast.text}
            {toast.undo && (
              <button onClick={() => undo(toast.undo!)} className="text-sm text-rust underline">
                Undo
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 text-ink shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
