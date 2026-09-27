import { findInvite } from "@/lib/auth";
import { acceptInvite } from "@/app/(auth)/actions";
import { Alert, SubmitButton } from "@/components/ui";
import { formatPhone } from "@/lib/phone";

export const metadata = { title: "Set up your account" };

const ERRORS: Record<string, string> = {
  expired: "This invite link has expired or was already used. Ask the parish office to send a new one.",
  short_password: "Passwords need at least 8 characters.",
  mismatch: "The two passwords do not match.",
  need_contact: "Enter a mobile number or an email address so we can reach you.",
  phone_taken: "That mobile number belongs to another account.",
  email_taken: "That email belongs to another account.",
};

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const found = await findInvite(token);

  if (!found) {
    return (
      <div className="card w-full max-w-md p-6">
        <Alert kind="error">{ERRORS.expired}</Alert>
      </div>
    );
  }
  const { user } = found;

  return (
    <div className="card w-full max-w-md p-6">
      <h2 className="mb-1 text-lg">Welcome, {user.firstName}</h2>
      <p className="mb-4 text-sm text-muted">Confirm how we reach you and, if you want one, choose a password. You can always sign in with a texted code instead.</p>
      {sp.error && (
        <div className="mb-4">
          <Alert kind="error">{ERRORS[sp.error] ?? sp.error}</Alert>
        </div>
      )}
      <form action={acceptInvite} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <div>
          <label className="label">Mobile number</label>
          <input name="phone" className="input" inputMode="tel" defaultValue={formatPhone(user.phone)} placeholder="(908) 555-0123" />
        </div>
        <div>
          <label className="label">Email</label>
          <input name="email" type="email" className="input" defaultValue={user.email ?? ""} />
        </div>
        <fieldset className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="notifySms" defaultChecked /> Text me reminders before I serve
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="notifyEmail" defaultChecked /> Email me reminders and open-slot notices
          </label>
        </fieldset>
        <div className="border-t border-line pt-4">
          <label className="label">Password (optional)</label>
          <input name="password" type="password" className="input" autoComplete="new-password" minLength={8} />
          <input name="confirm" type="password" className="input mt-2" autoComplete="new-password" placeholder="Confirm password" />
        </div>
        <SubmitButton className="btn-accent w-full" pendingText="Saving...">
          Finish setup
        </SubmitButton>
      </form>
    </div>
  );
}
