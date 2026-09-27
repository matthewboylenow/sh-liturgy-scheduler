import Image from "next/image";
import { env } from "@/lib/env";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <Image src="/brand/saint-helen-mark.png" alt="" width={56} height={56} priority className="mx-auto mb-3 h-14 w-14" />
        <h1 className="text-2xl text-navy">{env.parishName()} Liturgy</h1>
      </div>
      {children}
    </main>
  );
}
