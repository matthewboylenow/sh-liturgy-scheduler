"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; muted?: boolean; icon?: IconName };

function isActive(href: string, path: string) {
  if (href === "/admin" || href === "/app") return path === href;
  return path === href || path.startsWith(href + "/");
}

/** Top tabs. Pill-shaped, 44px tall. */
export function NavLinks({ items }: { items: Item[] }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto py-2 text-base">
      {items.map((n) => {
        const active = isActive(n.href, path);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-4 font-semibold transition ${
              active ? "bg-navy text-white" : n.muted ? "text-muted hover:bg-sand hover:text-ink" : "text-navy hover:bg-sand"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Phone tab bar for volunteers: four big targets with an icon and a word, fixed to the bottom. */
export function BottomNav({ items }: { items: Item[] }) {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden print:hidden" aria-label="Main">
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((n) => {
          const active = isActive(n.href, path);
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold ${active ? "text-rust" : "text-navy/80"}`}
              >
                <Icon name={n.icon ?? "dot"} />
                <span>{n.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export type IconName = "home" | "plus" | "calendar" | "person" | "dot";

function Icon({ name }: { name: IconName }) {
  const common = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5 10v10h5v-6h4v6h5V10" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
          <path d="m9 15 2 2 4-4" />
        </svg>
      );
    case "person":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
  }
}
