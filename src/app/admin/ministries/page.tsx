import { asc, count } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/db";
import { ministries, ministryMembers } from "@/db/schema";
import { PageTitle, MinistryPill } from "@/components/shell";
import { Flash } from "@/components/flash";
import { SubmitButton } from "@/components/ui";
import { saveMinistry, toggleMinistry } from "@/app/admin/actions";

export const metadata = { title: "Ministries" };

export default async function MinistriesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await requireAdmin();
  const list = await db.select().from(ministries).orderBy(asc(ministries.sortOrder), asc(ministries.name));
  const counts = await db.select({ ministryId: ministryMembers.ministryId, n: count() }).from(ministryMembers).groupBy(ministryMembers.ministryId);
  const countMap = new Map(counts.map((c) => [c.ministryId, c.n]));
  const editing = sp.edit ? list.find((m) => m.id === sp.edit) : null;

  return (
    <>
      <PageTitle title="Ministries" subtitle="Presider and Deacon are ministries too, so clergy appear on the schedule." />
      <Flash sp={sp} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card overflow-x-auto lg:col-span-2">
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Ministry</th>
                <th>Members</th>
                <th>Kiosk</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.id} className={m.active ? "" : "opacity-50"}>
                  <td className="text-muted">{m.sortOrder}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <MinistryPill ministry={m} />
                      <span className="font-medium">{m.name}</span>
                      {!m.active && <span className="pill bg-gray-100">inactive</span>}
                    </div>
                    {m.description && <div className="text-xs text-muted">{m.description}</div>}
                  </td>
                  <td>{countMap.get(m.id) ?? 0}</td>
                  <td className="text-xs">{m.checkInEnabled ? "check-in" : "hidden"}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <a href={`/admin/ministries?edit=${m.id}`} className="btn-ghost px-2 py-1 text-xs">
                        Edit
                      </a>
                      <form action={toggleMinistry}>
                        <input type="hidden" name="id" value={m.id} />
                        <button className="btn-ghost px-2 py-1 text-xs">{m.active ? "Deactivate" : "Activate"}</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted">
                    No ministries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form action={saveMinistry} className="card space-y-3 p-4 self-start" key={editing?.id ?? "new"}>
          <h2 className="text-lg">{editing ? `Edit ${editing.shortName}` : "Add a ministry"}</h2>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div>
            <label className="label">Name</label>
            <input name="name" className="input" defaultValue={editing?.name} required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Short name</label>
              <input name="shortName" className="input" defaultValue={editing?.shortName} required maxLength={16} />
            </div>
            <div>
              <label className="label">Color</label>
              <input name="color" type="color" className="input h-10 p-1" defaultValue={editing?.color ?? "#1F346D"} />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <input name="description" className="input" defaultValue={editing?.description ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Sort order</label>
              <input name="sortOrder" type="number" className="input" defaultValue={editing?.sortOrder ?? 100} />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" name="checkInEnabled" defaultChecked={editing ? editing.checkInEnabled : true} /> Show on kiosk
            </label>
          </div>
          <div className="flex gap-2">
            <SubmitButton>{editing ? "Save" : "Add"}</SubmitButton>
            {editing && (
              <a href="/admin/ministries" className="btn-ghost">
                Cancel
              </a>
            )}
          </div>
        </form>
      </div>
    </>
  );
}
