import Link from "next/link";
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
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href={area === "admin" ? "/admin" : "/app"} className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy font-serif text-white">†</span>
            <span className="font-serif text-lg text-navy">{env.parishName()} Liturgy</span>
            {area === "admin" && <span className="pill bg-rust/10 text-rust">Admin</span>}
          </Link>
          <nav className="hidden items-center gap-1 text-sm md:flex">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="rounded px-3 py-1.5 text-ink hover:bg-cream">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            {isStaff && area === "volunteer" && (
              <Link href="/admin" className="hidden text-rust underline sm:inline">
                Admin
              </Link>
            )}
            {area === "admin" && (
              <Link href="/app" className="hidden text-muted underline sm:inline">
                Volunteer view
              </Link>
            )}
            <span className="hidden text-muted sm:inline">{user.firstName}</span>
            <form action="/api/auth/logout" method="post">
              <button className="btn-ghost px-3 py-1">Sign out</button>
            </form>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-line px-2 py-1 text-sm md:hidden">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded px-3 py-1.5 hover:bg-cream">
              {n.label}
            </Link>
          ))}
          {isStaff && area === "volunteer" && (
            <Link href="/admin" className="whitespace-nowrap rounded px-3 py-1.5 text-rust">
              Admin
            </Link>
          )}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <footer className="px-4 py-4 text-center text-xs text-muted">Parish Community of {env.parishName()} · Westfield, NJ</footer>
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
