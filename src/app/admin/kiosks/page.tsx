import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/db";
import { kiosks } from "@/db/schema";
import { PageTitle } from "@/components/shell";
import { Flash } from "@/components/flash";
import { Alert, SubmitButton, ConfirmButton } from "@/components/ui";
import { createKiosk, deleteKiosk, toggleKiosk } from "@/app/admin/actions";
import { env } from "@/lib/env";
import { fmtInstant } from "@/lib/time";

export const metadata = { title: "Kiosks" };

export default async function KiosksPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await requireAdmin();
  const list = await db.select().from(kiosks).orderBy(desc(kiosks.createdAt));
  const base = env.appUrl();

  return (
    <>
      <PageTitle title="Kiosks" subtitle="One key per sacristy screen. A keyed screen shows today's roster and takes check-ins without a login." />
      <Flash sp={sp} />
      {sp.newKey && (
        <div className="mb-4">
          <Alert kind="success">
            <p className="mb-1 font-semibold">Open this link once on the device. It is shown only now.</p>
            <code className="block break-all rounded bg-white p-2 text-xs">{`${base}/kiosk?key=${sp.newKey}`}</code>
            <p className="mt-1 text-xs">The key is stored in a cookie for a year. Set Chromium to open the kiosk URL at boot.</p>
          </Alert>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Last seen</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((k) => (
                <tr key={k.id}>
                  <td className="font-medium">{k.name}</td>
                  <td className="text-xs text-muted">{k.lastSeenAt ? fmtInstant(k.lastSeenAt) : "never"}</td>
                  <td>{k.active ? <span className="pill bg-green-100 text-green-800">active</span> : <span className="pill bg-gray-100">disabled</span>}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <form action={toggleKiosk}>
                        <input type="hidden" name="id" value={k.id} />
                        <button className="btn-ghost px-2 py-1 text-xs">{k.active ? "Disable" : "Enable"}</button>
                      </form>
                      <form action={deleteKiosk}>
                        <input type="hidden" name="id" value={k.id} />
                        <ConfirmButton className="btn-danger px-2 py-1 text-xs" message="Remove this kiosk? The screen will stop working until it is keyed again.">
                          Remove
                        </ConfirmButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted">
                    No kiosks yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <form action={createKiosk} className="card space-y-3 p-4 self-start">
          <h2 className="text-lg">Add a kiosk</h2>
          <input name="name" className="input" placeholder="Name" aria-label="Kiosk name" />
          <SubmitButton>Create key</SubmitButton>
        </form>
      </div>
    </>
  );
}
