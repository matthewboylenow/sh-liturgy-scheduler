import { notFound } from "next/navigation";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { requireStaff, canManageMinistry } from "@/lib/auth";
import { db } from "@/db";
import { ministries } from "@/db/schema";
import { getLiturgy, groupByMinistry, liveAssignment, getMinistryMembers, coverage } from "@/lib/schedule";
import { fmtDateLong, fmtTime, fmtInstant } from "@/lib/time";
import { PageTitle, MinistryPill, StatusPill } from "@/components/shell";
import { Flash } from "@/components/flash";
import { SubmitButton, ConfirmButton } from "@/components/ui";
import { addPosition, assignPerson, deleteLiturgy, removePosition, staffAssignmentAction, updateLiturgy } from "@/app/admin/actions";
import { formatPhone } from "@/lib/phone";

export default async function LiturgyAdminPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireStaff();
  const admin = user.role === "admin";
  const l = await getLiturgy(id);
  if (!l) notFound();
  const groups = groupByMinistry(l);
  const allMinistries = await db.select().from(ministries).where(eq(ministries.active, true)).orderBy(asc(ministries.sortOrder));
  const manageable = allMinistries.filter((m) => canManageMinistry(user, m.id));
  // Members for each manageable ministry present on this Mass (for the assign dropdowns)
  const memberLists = new Map<string, Awaited<ReturnType<typeof getMinistryMembers>>>();
  await Promise.all(
    groups
      .filter((g) => canManageMinistry(user, g.ministry.id))
      .map(async (g) => memberLists.set(g.ministry.id, await getMinistryMembers(g.ministry.id))),
  );
  const self = `/admin/schedule/${id}`;
  const c = coverage(l);
  const past = l.startsAt < new Date();

  return (
    <>
      <PageTitle
        title={`${fmtDateLong(l.date)} · ${fmtTime(l.time)}`}
        subtitle={`${l.title ? `${l.title} · ` : ""}${l.location} · ${c.filled}/${c.total} filled${c.subs ? ` · ${c.subs} need a sub` : ""}`}
        actions={
          <>
            <StatusPill status={l.status} />
            <Link href="/admin/schedule" className="btn-ghost">
              All Masses
            </Link>
            <Link href={`/app/liturgy/${id}`} className="btn-ghost">
              Volunteer view
            </Link>
          </>
        }
      />
      <Flash sp={sp} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {groups.length === 0 && <p className="card p-4 text-sm text-muted">No positions yet. Add some on the right.</p>}
          {groups.map((g) => {
            const can = canManageMinistry(user, g.ministry.id);
            const members = memberLists.get(g.ministry.id) ?? [];
            return (
              <div key={g.ministry.id} className="card">
                <div className="flex items-center justify-between border-b border-line px-4 py-2">
                  <div className="flex items-center gap-2">
                    <MinistryPill ministry={g.ministry} />
                    <span className="font-medium">{g.ministry.name}</span>
                  </div>
                  <span className="text-xs text-muted">
                    {g.positions.filter((p) => liveAssignment(p) && liveAssignment(p)!.status !== "sub_requested").length}/{g.positions.length}
                  </span>
                </div>
                <ul className="divide-y divide-line/70">
                  {g.positions.map((p) => {
                    const a = liveAssignment(p);
                    const alreadyHere = new Set(l.positions.map((pp) => liveAssignment(pp)?.userId).filter(Boolean));
                    return (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          {p.label && <span className="w-8 text-xs text-muted">{p.label}</span>}
                          {a ? (
                            <div>
                              <Link href={`/admin/people/${a.userId}`} className="font-medium hover:underline">
                                {a.user.firstName} {a.user.lastName}
                              </Link>
                              <span className="ml-2 text-xs text-muted">{formatPhone(a.user.phone)}</span>
                              <span className="ml-2">
                                <StatusPill status={a.status} />
                              </span>
                              {a.checkedInAt && <span className="ml-2 pill bg-green-100 text-green-800">checked in {fmtInstant(a.checkedInAt, "h:mm a")}</span>}
                            </div>
                          ) : (
                            <span className="italic text-muted">Open</span>
                          )}
                        </div>
                        {can && (
                          <div className="flex flex-wrap items-center gap-1">
                            {a ? (
                              <>
                                <form action={staffAssignmentAction}>
                                  <input type="hidden" name="assignmentId" value={a.id} />
                                  <input type="hidden" name="return" value={self} />
                                  <input type="hidden" name="action" value={a.checkedInAt ? "uncheckin" : "checkin"} />
                                  <button className="btn-ghost px-2 py-1 text-xs">{a.checkedInAt ? "Undo check-in" : "Check in"}</button>
                                </form>
                                <form action={staffAssignmentAction}>
                                  <input type="hidden" name="assignmentId" value={a.id} />
                                  <input type="hidden" name="return" value={self} />
                                  <input type="hidden" name="action" value="drop" />
                                  <ConfirmButton className="btn-danger px-2 py-1 text-xs" message={`Remove ${a.user.firstName} from this slot?`}>
                                    Remove
                                  </ConfirmButton>
                                </form>
                              </>
                            ) : (
                              <>
                                <form action={assignPerson} className="flex gap-1">
                                  <input type="hidden" name="positionId" value={p.id} />
                                  <select name="userId" className="input max-w-[14rem] py-1 text-xs" required defaultValue="">
                                    <option value="" disabled>
                                      Assign someone...
                                    </option>
                                    {members
                                      .filter((m) => m.status !== "inactive")
                                      .map((m) => (
                                        <option key={m.id} value={m.id} disabled={alreadyHere.has(m.id)}>
                                          {m.lastName}, {m.firstName}
                                          {alreadyHere.has(m.id) ? " (already serving)" : ""}
                                        </option>
                                      ))}
                                  </select>
                                  <SubmitButton className="btn-primary px-2 py-1 text-xs" pendingText="...">
                                    Assign
                                  </SubmitButton>
                                </form>
                                <form action={removePosition}>
                                  <input type="hidden" name="positionId" value={p.id} />
                                  <button className="btn-ghost px-2 py-1 text-xs" title="Remove this position">
                                    ✕
                                  </button>
                                </form>
                              </>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          {manageable.length > 0 && !past && (
            <form action={addPosition} className="card space-y-2 p-4">
              <h2 className="text-lg">Add positions</h2>
              <input type="hidden" name="liturgyId" value={id} />
              <div className="flex gap-2">
                <select name="ministryId" className="input" required>
                  {manageable.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <input type="number" name="count" min={1} max={20} defaultValue={1} className="input w-20" />
              </div>
              <SubmitButton className="btn-ghost">Add</SubmitButton>
            </form>
          )}

          {admin && (
            <form action={updateLiturgy} className="card space-y-3 p-4">
              <h2 className="text-lg">Details</h2>
              <input type="hidden" name="id" value={id} />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Date</label>
                  <input type="date" name="date" defaultValue={l.date} className="input" required />
                </div>
                <div>
                  <label className="label">Time</label>
                  <input type="time" name="time" defaultValue={l.time} className="input" required />
                </div>
              </div>
              <div>
                <label className="label">Label</label>
                <input name="label" defaultValue={l.label} className="input" />
              </div>
              <div>
                <label className="label">Title</label>
                <input name="title" defaultValue={l.title ?? ""} className="input" placeholder="e.g. First Sunday of Advent" />
              </div>
              <div>
                <label className="label">Location</label>
                <input name="location" defaultValue={l.location} className="input" />
              </div>
              <div>
                <label className="label">Notes to volunteers</label>
                <textarea name="notes" defaultValue={l.notes ?? ""} className="input" rows={2} placeholder="Incense today. Servers arrive 20 minutes early." />
              </div>
              <div>
                <label className="label">Status</label>
                <select name="status" defaultValue={l.status} className="input">
                  <option value="draft">Draft (hidden from volunteers)</option>
                  <option value="published">Published</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <SubmitButton>Save</SubmitButton>
            </form>
          )}

          {admin && (
            <form action={deleteLiturgy} className="card p-4">
              <input type="hidden" name="id" value={id} />
              <p className="mb-2 text-xs text-muted">Deleting removes all positions and sign-ups for this Mass. Prefer Cancelled if people were already assigned.</p>
              <ConfirmButton message="Delete this Mass and all of its sign-ups? This cannot be undone.">Delete Mass</ConfirmButton>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
