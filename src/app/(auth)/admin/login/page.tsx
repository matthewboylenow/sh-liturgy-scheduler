import { redirect } from "next/navigation";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";
import { microsoftConfigured } from "@/lib/microsoft";
import Link from "next/link";

export const metadata = { title: "Staff sign in" };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (user && isStaff(user)) redirect(sp.next && sp.next.startsWith("/") ? sp.next : "/admin");
  return (
    <>
      <LoginForm area="admin" tab={sp.tab ?? "password"} error={sp.error} next={sp.next} showMicrosoft={microsoftConfigured() || process.env.NODE_ENV !== "production"} />
      <p className="mt-6 text-xs text-white/70">
        <Link href="/login" className="underline">Volunteer sign-in</Link>
      </p>
    </>
  );
}
