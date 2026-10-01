"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

/**
 * Sign-in sits beside a photo of the parish at Mass with a navy overlay, like the homepage hero on sainthelen.org.
 * Staff sign-in drops the photo for a plain navy panel, so nobody mistakes one for the other.
 */
export function AuthFrame({ parish, children }: { parish: string; children: React.ReactNode }) {
  const staff = usePathname().startsWith("/admin");
  return (
    <main className="flex flex-1 flex-col lg:flex-row">
      <section className={`relative flex items-end overflow-hidden text-white lg:w-1/2 lg:min-h-full ${staff ? "band" : ""}`}>
        {!staff && (
          <>
            <Image src="/brand/church.jpg" alt="" fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/75 to-navy/40" />
          </>
        )}
        <div className="relative w-full px-6 py-8 sm:px-10 lg:px-14 lg:py-16">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white">
              <Image src="/brand/saint-helen-mark.png" alt="" width={40} height={40} priority className="h-10 w-10" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">Parish Community of {parish}</span>
          </div>
          <h1 className="font-serif text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">{staff ? "Staff sign-in" : "Liturgy Scheduler"}</h1>
          <p className="mt-3 max-w-md text-base text-white/85 sm:text-lg">
            {staff ? "Schedules, people, and the weekend sheet." : "Sign up to serve at Mass, see your schedule, and let us know when you are away."}
          </p>
        </div>
      </section>
      <section className="flex flex-1 flex-col items-center justify-start px-4 py-8 sm:px-8 lg:w-1/2 lg:justify-center">{children}</section>
    </main>
  );
}
