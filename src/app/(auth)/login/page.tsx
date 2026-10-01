import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";
import Link from "next/link";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(sp.next && sp.next.startsWith("/") ? sp.next : "/app");
  return (
    <>
      <LoginForm area="app" tab={sp.tab ?? "code"} error={sp.error} next={sp.next} />
      <p className="mt-6 text-sm text-muted">
        <Link href="/admin/login" className="underline">Staff sign-in</Link>
      </p>
    </>
  );
}
