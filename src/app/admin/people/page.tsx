import Link from "next/link";
import { and, asc, eq, ilike, or, inArray } from "drizzle-orm";
import { requireStaff } from "@/lib/auth";
import { db } from "@/db";
import { users, ministries, ministryMembers } from "@/db/schema";
import { PageTitle, MinistryPill, StatusPill } from "@/components/shell";
import { Flash } from "@/components/flash";
import { SubmitButton } from "@/components/ui";
import { createPerson } from "@/app/admin/actions";
import { formatPhone } from "@/lib/phone";

export const metadata = { title: "People" };

export default async function PeoplePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireStaff();
  const admin = user.role === "admin";
  const q = (sp.q ?? "").trim();

  const allMinistries = await db.select().from(ministries).where(eq(ministries.active, true)).orderBy(asc(ministries.sortOrder));
  const manageable = admin ? allMinistries : allMinistries.filter((m) => user.coordinatorOf.includes(m.id));

  // Coordinators only see people in their ministries
  let idsFilter: string[] | null = null;
  if (!admin) {
    const rows = await db.select({ userId: ministryMembers.userId }).from(ministryMembers).where(inArray(ministryMembers.ministryId, user.coordinatorOf.length ? user.coordinatorOf : ["00000000-0000-0000-0000-000000000000"]));
    idsFilter = [...new Set(rows.map((r) => r.userId))];
  }

  const conds = [];
  if (q) conds.push(or(ilike(users.firstName, `%${q}%`), ilike(users.lastName, `%${q}%`), ilike(users.email, `%${q}%`), ilike(users.phone, `%${q.replace(/\D/g, "")}%`)));
  if (sp.status) conds.push(eq(users.status, sp.status as "invited" | "active" | "inactive"));
  if (idsFilter) conds.push(inArray(users.id, idsFilter.length ? idsFilter : ["00000000-0000-0000-0000-000000000000"]));

  const people = await db.query.users.findMany({
    where: conds.length ? and(...conds) : undefined,
    orderBy: [asc(users.lastName), asc(users.firstName)],
    with: { memberships: { with: { ministry: true } } },
    limit: 500,
  });
  const filterMin = sp.ministry;
  const list = filterMin ? people.filter((p) => p.memberships.some((m) => m.ministryId === filterMin)) : people;

  return (
    <>
      <PageTitle
        title="People"
        subtitle={`${list.length} shown`}
        actions={
          admin && (
            <Link href="/admin/people/import" className="btn-ghost">
              Import CSV
            </Link>
          )
        }
      />
      <Flash sp={sp} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <form className="mb-3 flex flex-wrap gap-2" method="get">
            <input name="q" defaultValue={q} className="input max-w-xs" placeholder="Search" aria-label="Search by name, phone, or email" />
            <select name="ministry" defaultValue={filterMin ?? ""} className="input max-w-[14rem]">
              <option value="">All ministries</option>
              {allMinistries.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <select name="status" defaultValue={sp.status ?? ""} className="input max-w-[10rem]">
              <option value="">Any status</option>
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="inactive">Inactive</option>
            </select>
            <button className="btn-ghost">Filter</button>
          </form>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Ministries</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/people/${p.id}`} className="font-medium hover:underline">
                        {p.lastName}, {p.firstName}
                      </Link>
                      {p.role !== "volunteer" && <span className="ml-2 pill bg-rust/10 text-rust">{p.role}</span>}
                    </td>
                    <td className="text-xs text-muted">
                      {formatPhone(p.phone)}
                      {p.phone && p.email ? <br /> : null}
                      {p.email}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {p.memberships.map((m) => (
                          <MinistryPill key={m.ministryId} ministry={m.ministry} />
                        ))}
                      </div>
                    </td>
                    <td>
                      <StatusPill status={p.status} />
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted">
                      No one matches.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <form action={createPerson} className="card space-y-3 p-4 self-start">
          <h2 className="text-lg">Add a person</h2>
          <div className="grid grid-cols-2 gap-2">
            <input name="firstName" className="input" placeholder="First name" aria-label="First name" required />
            <input name="lastName" className="input" placeholder="Last name" aria-label="Last name" required />
          </div>
          <input name="phone" className="input" placeholder="Mobile" aria-label="Mobile number" inputMode="tel" />
          <input name="email" className="input" placeholder="Email" aria-label="Email" type="email" />
          {admin && (
            <select name="role" className="input" defaultValue="volunteer">
              <option value="volunteer">Volunteer</option>
              <option value="coordinator">Ministry coordinator</option>
              <option value="admin">Admin (staff)</option>
            </select>
          )}
          <fieldset>
            <legend className="label">Ministries</legend>
            <div className="grid max-h-56 gap-1 overflow-y-auto text-sm">
              {manageable.map((m) => (
                <label key={m.id} className="flex items-center gap-2">
                  <input type="checkbox" name="ministryIds" value={m.id} /> {m.name}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="sendInvite" defaultChecked /> Send the invite now
          </label>
          <SubmitButton pendingText="Adding">Add</SubmitButton>
        </form>
      </div>
    </>
  );
}
