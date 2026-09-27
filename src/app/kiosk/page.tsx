import { redirect } from "next/navigation";
import { getKiosk } from "@/lib/kiosk";
import { KioskBoard } from "./board";
import { env } from "@/lib/env";

export const metadata = { title: "Check-in" };

export default async function KioskPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  if (sp.key) redirect(`/api/kiosk/activate?key=${encodeURIComponent(sp.key)}`);
  const kiosk = await getKiosk();
  if (!kiosk) {
    return (
      <main className="flex flex-1 items-center justify-center bg-navy p-8 text-center text-white">
        <div>
          <h1 className="mb-2 text-3xl">This screen is not set up yet</h1>
          <p className="text-white/70">An admin creates a key under Kiosks and opens that link here once.</p>
          {sp.bad && <p className="mt-3 text-rust">That key is not valid, or the kiosk was disabled.</p>}
        </div>
      </main>
    );
  }
  return <KioskBoard kioskName={kiosk.name} parish={env.parishName()} />;
}
