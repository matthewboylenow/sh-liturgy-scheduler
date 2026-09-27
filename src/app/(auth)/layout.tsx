import { env } from "@/lib/env";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-navy text-white">
          <span className="font-serif text-xl">†</span>
        </div>
        <h1 className="text-2xl text-navy">{env.parishName()} Liturgy</h1>
        <p className="text-sm text-muted">Weekend ministry sign-ups</p>
      </div>
      {children}
    </main>
  );
}
