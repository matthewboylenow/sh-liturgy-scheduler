"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items }: { items: { href: string; label: string; muted?: boolean }[] }) {
  const path = usePathname();
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto text-sm">
      {items.map((n) => {
        const active = n.href === path || (n.href !== "/admin" && n.href !== "/app" && path.startsWith(n.href + "/")) || (n.href !== "/admin" && n.href !== "/app" && path === n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 font-medium transition ${
              active ? "border-rust text-navy" : n.muted ? "border-transparent text-muted hover:text-ink" : "border-transparent text-ink/80 hover:border-line hover:text-ink"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
