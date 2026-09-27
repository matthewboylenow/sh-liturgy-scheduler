import { passwordLogin, requestLoginCode } from "@/app/(auth)/actions";
import { SubmitButton, Alert } from "@/components/ui";
import Link from "next/link";

const ERRORS: Record<string, string> = {
  bad_destination: "Enter the mobile number or email address the parish has on file for you.",
  no_account: "We don't have an account for that number or email. Contact the parish office and we will set you up.",
  not_staff: "That account is a volunteer account. Sign in through the volunteer portal instead.",
  bad_login: "That username or password is not right.",
  mfa_no_destination: "Your account has no phone or email for the verification code. Contact the parish office.",
  mfa_expired: "That sign-in attempt timed out. Start again.",
  ms_not_configured: "Microsoft sign-in has not been set up yet.",
  ms_denied: "Microsoft sign-in was cancelled.",
  ms_state: "Microsoft sign-in did not complete. Try again.",
  ms_exchange: "Microsoft sign-in failed. Try again or use another method.",
  ms_no_account: "Your Microsoft account is not linked to a staff account here. An admin needs to add you first.",
};

export function LoginForm({
  area,
  tab,
  error,
  next,
  showMicrosoft,
}: {
  area: "app" | "admin";
  tab: string;
  error?: string;
  next?: string;
  showMicrosoft?: boolean;
}) {
  const base = area === "admin" ? "/admin/login" : "/login";
  const errorText = error ? ERRORS[error] ?? decodeURIComponent(error) : null;
  const activeTab = tab === "password" ? "password" : "code";
  const nextVal = next ?? (area === "admin" ? "/admin" : "/app");

  return (
    <div className="card w-full max-w-md p-6">
      <div className="mb-4 flex rounded-md border border-line p-1 text-sm">
        <Link
          href={`${base}?tab=code${next ? `&next=${encodeURIComponent(next)}` : ""}`}
          className={`flex-1 rounded px-3 py-1.5 text-center font-medium ${activeTab === "code" ? "bg-navy text-white" : "text-muted hover:text-ink"}`}
        >
          Text me a code
        </Link>
        <Link
          href={`${base}?tab=password${next ? `&next=${encodeURIComponent(next)}` : ""}`}
          className={`flex-1 rounded px-3 py-1.5 text-center font-medium ${activeTab === "password" ? "bg-navy text-white" : "text-muted hover:text-ink"}`}
        >
          Password
        </Link>
      </div>

      {errorText && (
        <div className="mb-4">
          <Alert kind="error">{errorText}</Alert>
        </div>
      )}

      {activeTab === "code" ? (
        <form action={requestLoginCode} className="space-y-4">
          <input type="hidden" name="area" value={area} />
          <input type="hidden" name="next" value={nextVal} />
          <div>
            <label className="label" htmlFor="destination">
              Mobile number or email
            </label>
            <input id="destination" name="destination" className="input" inputMode="tel" autoComplete="tel" placeholder="(908) 555-0123" required autoFocus />
            <p className="mt-1 text-xs text-muted">We will send a six digit code. No password needed.</p>
          </div>
          <SubmitButton pendingText="Sending...">Send code</SubmitButton>
        </form>
      ) : (
        <form action={passwordLogin} className="space-y-4">
          <input type="hidden" name="area" value={area} />
          <input type="hidden" name="next" value={nextVal} />
          <div>
            <label className="label" htmlFor="identifier">
              Username, email, or mobile
            </label>
            <input id="identifier" name="identifier" className="input" autoComplete="username" required autoFocus />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
          </div>
          <SubmitButton pendingText="Checking...">Sign in</SubmitButton>
          {area === "admin" && <p className="text-xs text-muted">Staff accounts always get a verification code after the password.</p>}
        </form>
      )}

      {showMicrosoft && (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
          <a href={`/api/auth/microsoft?next=${encodeURIComponent(nextVal)}`} className="btn-ghost w-full">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <rect width="7" height="7" fill="#f25022" />
              <rect x="9" width="7" height="7" fill="#7fba00" />
              <rect y="9" width="7" height="7" fill="#00a4ef" />
              <rect x="9" y="9" width="7" height="7" fill="#ffb900" />
            </svg>
            Sign in with Microsoft 365
          </a>
        </>
      )}
    </div>
  );
}
