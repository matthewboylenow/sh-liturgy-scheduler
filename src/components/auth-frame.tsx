"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

/** Volunteer sign-in sits on the cream canvas. Staff sign-in is navy, so nobody mistakes one for the other. */
export function AuthFrame({ parish, children }: { parish: string; children: React.ReactNode }) {
  const staff = usePathname().startsWith("/admin");
  return (
    <main className={`flex flex-1 flex-col items-center justify-center px-4 py-10 ${staff ? "bg-navy text-white" : ""}`}>
      <div className="mb-6 text-center">
        <span className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-xl ${staff ? "bg-white" : ""}`}>
          <Image src="/brand/saint-helen-mark.png" alt="" width={56} height={56} priority className="h-14 w-14" />
        </span>
        <h1 className={`text-2xl ${staff ? "text-white" : "text-navy"}`}>{parish} Liturgy Scheduler</h1>
        {staff && <p className="mt-1 text-sm uppercase tracking-widest text-white/60">Staff</p>}
      </div>
      {children}
    </main>
  );
}
