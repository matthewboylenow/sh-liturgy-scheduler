import { passwordLogin, requestLoginCode } from "@/app/(auth)/actions";
import { SubmitButton, Alert } from "@/components/ui";
import Link from "next/link";

const ERRORS: Record<string, string> = {
  bad_destination: "Enter a mobile number or email address.",
  no_account: "No account matches that number or email. Contact the parish office.",
  not_staff: "That is a volunteer account. Use the volunteer sign-in.",
  bad_login: "Wrong username or password.",
  too_many: "Too many attempts. Wait 15 minutes and try again.",
  mfa_no_destination: "This account has no phone or email for the code. Contact the parish office.",
  mfa_expired: "That sign-in timed out. Start again.",
  ms_not_configured: "Microsoft sign-in is not set up yet.",
  ms_denied: "Microsoft sign-in was cancelled.",
  ms_state: "Microsoft sign-in did not finish. Try again.",
  ms_exchange: "Microsoft sign-in failed. Try again or use a password.",
  ms_no_account: "No staff account matches that Microsoft account. Ask an admin to add you.",
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
    <div className="card w-full max-w-md p-6 sm:p-8">
      <h2 className="mb-5 text-2xl font-bold text-navy">{area === "admin" ? "Sign in" : "Welcome back"}</h2>
      <div className="mb-5 flex rounded-lg bg-sand p-1 text-base">
        <Link
          href={`${base}?tab=code${next ? `&next=${encodeURIComponent(next)}` : ""}`}
          className={`flex-1 rounded-md px-3 py-2.5 text-center font-semibold ${activeTab === "code" ? "bg-white text-navy shadow-sm" : "text-muted hover:text-ink"}`}
        >
          Send me a code
        </Link>
        <Link
          href={`${base}?tab=password${next ? `&next=${encodeURIComponent(next)}` : ""}`}
          className={`flex-1 rounded-md px-3 py-2.5 text-center font-semibold ${activeTab === "password" ? "bg-white text-navy shadow-sm" : "text-muted hover:text-ink"}`}
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
            <input id="destination" name="destination" className="input" inputMode="email" autoComplete="username" required autoFocus />
          </div>
          <SubmitButton className="btn-primary btn-lg w-full" pendingText="Sending">Send code</SubmitButton>
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
          <SubmitButton className="btn-primary btn-lg w-full" pendingText="Checking">Sign in</SubmitButton>
        </form>
      )}

      {showMicrosoft && (
        <>
          <div className="my-5 flex items-center gap-3 text-sm text-muted">
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
