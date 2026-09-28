import Link from "next/link";
import Image from "next/image";
import { NavLinks } from "@/components/nav-links";
import { returnToOwnAccount } from "@/app/admin/actions";
import type { SessionUser } from "@/lib/auth";
import { env } from "@/lib/env";

export function Shell({
  user,
  nav,
  area,
  children,
}: {
  user: SessionUser;
  nav: { href: string; label: string }[];
  area: "volunteer" | "admin";
  children: React.ReactNode;
}) {
  const isStaff = user.role === "admin" || user.role === "coordinator";
  return (
    <div className="flex min-h-full flex-1 flex-col">
      {user.impersonatorId && (
        <form action={returnToOwnAccount} className="flex items-center justify-center gap-3 bg-gold px-4 py-2 text-sm text-navy print:hidden">
          <span>
            Signed in as {user.firstName} {user.lastName}.
          </span>
          <button className="rounded-md border border-navy/30 bg-white px-3 py-1 font-semibold">Return to my account</button>
        </form>
      )}
      <header className="border-b border-line bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pt-3">
          <Link href={area === "admin" ? "/admin" : "/app"} className="flex items-center gap-2.5">
            <Image src="/brand/saint-helen-mark.png" alt="" width={36} height={36} className="h-9 w-9" />
            <span className="whitespace-nowrap font-serif text-lg text-navy sm:text-xl">{env.parishName()} Liturgy Scheduler</span>
            {area === "admin" && <span className="pill hidden bg-rust/10 text-rust sm:inline-flex">Admin</span>}
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-muted sm:inline">{user.firstName}</span>
            <form action="/api/auth/logout" method="post">
              <button className="btn-ghost whitespace-nowrap px-3 py-1.5">Sign out</button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4">
          <NavLinks
            items={[
              ...nav,
              ...(isStaff && area === "volunteer" ? [{ href: "/admin", label: "Admin", muted: true }] : []),
              ...(area === "admin" ? [{ href: "/app", label: "Volunteer view", muted: true }] : []),
            ]}
          />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <footer className="px-4 py-4 text-center text-xs text-muted print:hidden">Parish Community of {env.parishName()} · Westfield, NJ</footer>
    </div>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl text-navy">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function MinistryPill({ ministry }: { ministry: { shortName: string; color: string; name?: string } }) {
  return (
    <span className="pill text-white" style={{ background: ministry.color }} title={ministry.name}>
      {ministry.shortName}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    signed_up: "bg-navy/10 text-navy",
    confirmed: "bg-green-100 text-green-800",
    sub_requested: "bg-gold/30 text-yellow-900",
    declined: "bg-gray-100 text-gray-600",
    draft: "bg-gray-100 text-gray-700",
    published: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
    invited: "bg-gold/30 text-yellow-900",
    active: "bg-green-100 text-green-800",
    inactive: "bg-gray-100 text-gray-600",
  };
  const label = status.replace("_", " ");
  return <span className={`pill ${map[status] ?? "bg-gray-100"}`}>{label}</span>;
}
