import { notFound } from "next/navigation";
import Link from "next/link";
import { asc, eq, desc } from "drizzle-orm";
import { requireStaff } from "@/lib/auth";
import { db } from "@/db";
import { users, ministries, auditLog } from "@/db/schema";
import { PageTitle, StatusPill } from "@/components/shell";
import { Flash } from "@/components/flash";
import { SubmitButton } from "@/components/ui";
import { resendInvite, setTempPassword, updatePerson } from "@/app/admin/actions";
import { formatPhone } from "@/lib/phone";
import { getMyAssignments } from "@/lib/schedule";
import { fmtDate, fmtTime, fmtInstant } from "@/lib/time";

export default async function PersonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const actor = await requireStaff();
  const admin = actor.role === "admin";
  const p = await db.query.users.findFirst({ where: eq(users.id, id), with: { memberships: true } });
  if (!p) notFound();
  if (!admin && !p.memberships.some((m) => actor.coordinatorOf.includes(m.ministryId))) notFound();

  const [allMinistries, upcoming, past, log] = await Promise.all([
    db.select().from(ministries).orderBy(asc(ministries.sortOrder)),
    getMyAssignments(id),
    getMyAssignments(id, { past: true }),
    db.select().from(auditLog).where(eq(auditLog.actorId, id)).orderBy(desc(auditLog.createdAt)).limit(10),
  ]);
  const memberOf = new Map(p.memberships.map((m) => [m.ministryId, m.isCoordinator]));

  return (
    <>
      <PageTitle
        title={`${p.firstName} ${p.lastName}`}
        subtitle={`${p.role} · added ${fmtInstant(p.createdAt, "MMM d, yyyy")}`}
        actions={
          <Link href="/admin/people" className="btn-ghost">
            All people
          </Link>
        }
      />
      <Flash sp={sp} />

      <div className="grid gap-4 lg:grid-cols-3">
        <form action={updatePerson} className="card space-y-3 p-4 lg:col-span-2">
          <input type="hidden" name="id" value={p.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">First name</label>
              <input name="firstName" className="input" defaultValue={p.firstName} required />
            </div>
            <div>
              <label className="label">Last name</label>
              <input name="lastName" className="input" defaultValue={p.lastName} required />
            </div>
            <div>
              <label className="label">Mobile {p.phoneVerified && <span className="text-xs text-green-700">verified</span>}</label>
              <input name="phone" className="input" defaultValue={formatPhone(p.phone)} inputMode="tel" />
            </div>
            <div>
              <label className="label">Email {p.emailVerified && <span className="text-xs text-green-700">verified</span>}</label>
              <input name="email" type="email" className="input" defaultValue={p.email ?? ""} />
            </div>
            <div>
              <label className="label">Username (optional)</label>
              <input name="username" className="input" defaultValue={p.username ?? ""} />
            </div>
            {admin && (
              <>
                <div>
                  <label className="label">Role</label>
                  <select name="role" className="input" defaultValue={p.role}>
                    <option value="volunteer">Volunteer</option>
                    <option value="coordinator">Ministry coordinator</option>
                    <option value="admin">Admin (staff)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select name="status" className="input" defaultValue={p.status}>
                    <option value="invited">Invited (not finished setup)</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive (cannot sign in)</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 self-end text-sm">
                  <input type="checkbox" name="mfaRequired" defaultChecked={p.mfaRequired} /> Require code after password
                </label>
              </>
            )}
          </div>
          <div>
            <label className="label">Notes (staff only)</label>
            <textarea name="notes" className="input" rows={2} defaultValue={p.notes ?? ""} />
          </div>
          <fieldset>
            <legend className="label">Ministries</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {allMinistries.map((m) => {
                const can = admin || actor.coordinatorOf.includes(m.id);
                return (
                  <div key={m.id} className={`flex items-center justify-between rounded border border-line/70 px-2 py-1 text-sm ${!m.active ? "opacity-60" : ""}`}>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="ministryIds" value={m.id} defaultChecked={memberOf.has(m.id)} disabled={!can} />
                      {m.name}
                    </label>
                    {admin && (
                      <label className="flex items-center gap-1 text-xs text-muted" title="Coordinators can manage this ministry's slots and people">
                        <input type="checkbox" name="coordinatorIds" value={m.id} defaultChecked={memberOf.get(m.id) === true} /> coord.
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
          <SubmitButton>Save</SubmitButton>
        </form>

        <div className="space-y-4">
          <div className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg">Account</h2>
              <StatusPill status={p.status} />
            </div>
            <p className="text-xs text-muted">
              {p.passwordHash ? "Has a password." : "No password; signs in with a texted code."}
              {p.entraOid ? " Linked to Microsoft 365." : ""}
            </p>
            <form action={resendInvite} className="mt-3">
              <input type="hidden" name="id" value={p.id} />
              <SubmitButton className="btn-ghost w-full" pendingText="Sending...">
                {p.status === "invited" ? "Resend invite" : "Send setup link"}
              </SubmitButton>
            </form>
            {admin && (
              <form action={setTempPassword} className="mt-3 space-y-2 border-t border-line pt-3">
                <input type="hidden" name="id" value={p.id} />
                <label className="label">Set a temporary password</label>
                <input name="password" className="input" minLength={8} placeholder="At least 8 characters" required />
                <SubmitButton className="btn-ghost w-full">Set password and activate</SubmitButton>
              </form>
            )}
          </div>

          <div className="card p-4">
            <h2 className="mb-2 text-lg">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted">Not signed up for anything.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {upcoming.map((r) => (
                  <li key={r.assignment.id} className="flex justify-between">
                    <Link href={`/admin/schedule/${r.liturgy.id}`} className="hover:underline">
                      {fmtDate(r.liturgy.date)} · {fmtTime(r.liturgy.time)} · {r.ministry.shortName}
                    </Link>
                    <StatusPill status={r.assignment.status} />
                  </li>
                ))}
              </ul>
            )}
            {past.length > 0 && (
              <p className="mt-3 text-xs text-muted">
                Served {past.length} time{past.length === 1 ? "" : "s"} on record · checked in {past.filter((r) => r.assignment.checkedInAt).length}
              </p>
            )}
          </div>

          {log.length > 0 && (
            <div className="card p-4">
              <h2 className="mb-2 text-sm font-semibold">Recent activity</h2>
              <ul className="space-y-1 text-xs text-muted">
                {log.map((e) => (
                  <li key={e.id}>
                    {fmtInstant(e.createdAt)} · {e.action}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
