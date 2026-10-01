import Link from "next/link";
import Image from "next/image";
import { NavLinks, BottomNav, type IconName } from "@/components/nav-links";
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
  nav: { href: string; label: string; icon?: IconName }[];
  area: "volunteer" | "admin";
  children: React.ReactNode;
}) {
  const isStaff = user.role === "admin" || user.role === "coordinator";
  const volunteer = area === "volunteer";
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
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href={volunteer ? "/app" : "/admin"} className="flex min-w-0 items-center gap-3">
            <Image src="/brand/saint-helen-mark.png" alt="" width={44} height={44} className="h-10 w-10 shrink-0 sm:h-11 sm:w-11" />
            <span className="min-w-0 leading-tight">
              <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted sm:hidden">{volunteer ? env.parishName() : "Staff"}</span>
              <span className="block font-serif text-lg font-bold text-navy sm:hidden">Liturgy Scheduler</span>
              <span className="hidden truncate font-serif text-xl font-bold text-navy sm:block">{env.parishName()} Liturgy Scheduler</span>
              <span className="hidden text-xs uppercase tracking-[0.12em] text-muted sm:block">{volunteer ? "Parish Community of Saint Helen" : "Staff"}</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-base text-muted sm:inline">{user.firstName}</span>
            <form action="/api/auth/logout" method="post">
              <button className="btn-ghost min-h-10 whitespace-nowrap px-3 py-1.5 text-sm">Sign out</button>
            </form>
          </div>
        </div>
        <div className={`mx-auto max-w-6xl px-4 ${volunteer ? "hidden md:block" : ""}`}>
          <NavLinks
            items={[
              ...nav,
              ...(isStaff && volunteer ? [{ href: "/admin", label: "Admin", muted: true }] : []),
              ...(!volunteer ? [{ href: "/app", label: "Volunteer view", muted: true }] : []),
            ]}
          />
        </div>
      </header>
      <main className={`mx-auto w-full max-w-6xl flex-1 px-4 py-6 ${volunteer ? "pb-24 md:pb-8" : ""}`}>{children}</main>
      <footer className={`print:hidden ${volunteer ? "hidden md:block" : ""}`}>
        <div className="mx-auto max-w-6xl px-4 py-5 text-center text-sm text-muted">
          <span className="font-serif italic">Worshipping God, Serving Others, Making Disciples</span>
          <span className="mx-2">·</span>
          Parish Community of {env.parishName()}, Westfield, NJ
        </div>
      </footer>
      {volunteer && <BottomNav items={nav} />}
    </div>
  );
}

export function PageTitle({ title, subtitle, eyebrow, actions }: { title: string; subtitle?: string; eyebrow?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h1 className="text-3xl font-bold text-navy sm:text-[2rem]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-base text-muted">{subtitle}</p>}
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
