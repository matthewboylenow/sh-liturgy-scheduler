import { requireUser } from "@/lib/auth";
import { PageTitle } from "@/components/shell";
import { Alert, SubmitButton } from "@/components/ui";
import { changePassword, confirmContactChange, setMfa, updateProfile, addMyBlackout, removeMyBlackout } from "@/app/app/actions";
import { blackoutsFor } from "@/lib/blackouts";
import { fmtDate } from "@/lib/time";
import { formatPhone } from "@/lib/phone";

export const metadata = { title: "Profile" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const away = await blackoutsFor(user.id, { upcomingOnly: true });
  const OK: Record<string, string> = {
    saved: "Saved.",
    away: "Away dates saved. You will not get open-slot texts for them.",
    verified: "Verified and saved.",
    password: "Password updated.",
  };

  return (
    <>
      <PageTitle title="Profile" />
      {sp.error && (
        <div className="mb-4">
          <Alert kind="error">{sp.error}</Alert>
        </div>
      )}
      {sp.ok && (
        <div className="mb-4">
          <Alert kind="success">{OK[sp.ok] ?? "Saved."}</Alert>
        </div>
      )}

      {sp.verify && (
        <div className="card mb-4 border-navy/30 p-4">
          <h2 className="mb-1 text-lg">Enter the code</h2>
          <p className="mb-3 text-sm text-muted">Sent to {sp.verify.startsWith("+") ? formatPhone(sp.verify) : sp.verify}.</p>
          <form action={confirmContactChange} className="flex gap-2">
            <input type="hidden" name="dest" value={sp.verify} />
            <input name="code" className="input max-w-[10rem] text-center tracking-widest" inputMode="numeric" maxLength={6} required autoFocus />
            <SubmitButton>Confirm</SubmitButton>
          </form>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <form action={updateProfile} className="card space-y-4 p-4">
          <h2 className="text-lg">Contact and reminders</h2>
          <div>
            <label className="label">Name</label>
            <div className="text-sm">
              {user.firstName} {user.lastName} <span className="text-xs text-muted">(the parish office can change this)</span>
            </div>
          </div>
          <div>
            <label className="label">Mobile number</label>
            <input name="phone" className="input" inputMode="tel" defaultValue={formatPhone(user.phone)} />
            {user.phone && !user.phoneVerified && <p className="mt-1 text-xs text-yellow-800">Not verified yet.</p>}
          </div>
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" className="input" defaultValue={user.email ?? ""} />
          </div>
          <fieldset className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="notifySms" defaultChecked={user.notifySms} /> Text reminders
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="notifyEmail" defaultChecked={user.notifyEmail} /> Email reminders and open-slot notices
            </label>
          </fieldset>
          <SubmitButton>Save</SubmitButton>
        </form>

        <div className="space-y-4">
          <form action={changePassword} className="card space-y-3 p-4">
            <h2 className="text-lg">{user.passwordHash ? "Change password" : "Add a password"}</h2>
            {user.passwordHash && (
              <div>
                <label className="label">Current password</label>
                <input name="current" type="password" className="input" autoComplete="current-password" />
              </div>
            )}
            <div>
              <label className="label">New password</label>
              <input name="password" type="password" className="input" autoComplete="new-password" minLength={8} required />
            </div>
            <div>
              <label className="label">Confirm</label>
              <input name="confirm" type="password" className="input" autoComplete="new-password" minLength={8} required />
            </div>
            <SubmitButton className="btn-ghost">Save password</SubmitButton>
          </form>

          <div className="card space-y-3 p-4">
            <h2 className="text-lg">Dates I am away</h2>
            {away.length > 0 && (
              <ul className="space-y-1 text-sm">
                {away.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2">
                    <span>
                      {fmtDate(b.fromDate)}{b.toDate !== b.fromDate ? ` to ${fmtDate(b.toDate)}` : ""}
                      {b.note && <span className="text-xs text-muted"> · {b.note}</span>}
                    </span>
                    <form action={removeMyBlackout}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className="btn-ghost px-2 py-0.5 text-xs">Remove</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <form action={addMyBlackout} className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">From</label>
                  <input type="date" name="from" className="input" required />
                </div>
                <div>
                  <label className="label">To</label>
                  <input type="date" name="to" className="input" />
                </div>
              </div>
              <input name="note" className="input" placeholder="Note" aria-label="Note" />
              <SubmitButton className="btn-ghost">Add</SubmitButton>
            </form>
          </div>

          <form action={setMfa} className="card space-y-3 p-4">
            <h2 className="text-lg">Two-step sign-in</h2>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="mfa" defaultChecked={user.mfaRequired || user.role !== "volunteer"} disabled={user.role !== "volunteer"} />
              Ask for a code after my password
            </label>
            {user.role !== "volunteer" && <p className="text-xs text-muted">Always on for staff.</p>}
            {user.role === "volunteer" && <SubmitButton className="btn-ghost">Save</SubmitButton>}
          </form>
        </div>
      </div>
    </>
  );
}
