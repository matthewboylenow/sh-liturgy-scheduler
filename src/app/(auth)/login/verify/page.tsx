import { resendCode, verifyLoginCode, verifyMfaCode } from "@/app/(auth)/actions";
import { Alert, SubmitButton } from "@/components/ui";
import { formatPhone } from "@/lib/phone";

export const metadata = { title: "Enter the code" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const dest = sp.dest ?? "";
  const mfa = sp.mfa === "1";
  const area = sp.area === "admin" ? "admin" : "app";
  const next = sp.next ?? (area === "admin" ? "/admin" : "/app");
  const pretty = dest.startsWith("+") ? formatPhone(dest) : dest;

  return (
    <div className="card w-full max-w-md p-6">
      <h2 className="mb-1 text-lg">Enter the code</h2>
      <p className="mb-4 text-sm text-muted">
        Sent to <span className="font-medium text-ink">{pretty}</span>.
      </p>
      {sp.error && (
        <div className="mb-4">
          <Alert kind="error">{decodeURIComponent(sp.error)}</Alert>
        </div>
      )}
      {sp.sent && (
        <div className="mb-4">
          <Alert kind="success">New code sent.</Alert>
        </div>
      )}
      <form action={mfa ? verifyMfaCode : verifyLoginCode} className="space-y-4">
        <input type="hidden" name="dest" value={dest} />
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="area" value={area} />
        <input
          name="code"
          className="input text-center text-2xl tracking-[0.5em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
        />
        {mfa && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="remember" defaultChecked /> Remember this device for 30 days
          </label>
        )}
        <SubmitButton pendingText="Checking">Continue</SubmitButton>
      </form>
      <form action={resendCode} className="mt-4 text-center">
        <input type="hidden" name="dest" value={dest} />
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="area" value={area} />
        {mfa && <input type="hidden" name="mfa" value="1" />}
        <button type="submit" className="text-xs text-muted underline">
          Send a new code
        </button>
      </form>
    </div>
  );
}
