import { desc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/db";
import { auditLog, notificationLog, users } from "@/db/schema";
import { PageTitle } from "@/components/shell";
import { fmtInstant } from "@/lib/time";

export const metadata = { title: "Log" };

export default async function LogPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await requireAdmin();
  const tab = sp.tab === "messages" ? "messages" : "audit";
  const audit = tab === "audit" ? await db.select({ e: auditLog, u: users }).from(auditLog).leftJoin(users, eq(users.id, auditLog.actorId)).orderBy(desc(auditLog.createdAt)).limit(200) : [];
  const msgs = tab === "messages" ? await db.select().from(notificationLog).orderBy(desc(notificationLog.createdAt)).limit(200) : [];

  return (
    <>
      <PageTitle
        title="Log"
        actions={
          <>
            <a href="/admin/log" className={tab === "audit" ? "btn-primary" : "btn-ghost"}>
              Activity
            </a>
            <a href="/admin/log?tab=messages" className={tab === "messages" ? "btn-primary" : "btn-ghost"}>
              Texts and emails
            </a>
          </>
        }
      />
      <div className="card overflow-x-auto">
        {tab === "audit" ? (
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {audit.map(({ e, u }) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap text-xs text-muted">{fmtInstant(e.createdAt)}</td>
                  <td>{u ? `${u.firstName} ${u.lastName}` : "system"}</td>
                  <td>
                    <code className="text-xs">{e.action}</code>
                  </td>
                  <td className="text-xs text-muted">{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>To</th>
                <th>Kind</th>
                <th>Message</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {msgs.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap text-xs text-muted">{fmtInstant(m.createdAt)}</td>
                  <td className="text-xs">
                    {m.channel} · {m.destination}
                  </td>
                  <td>
                    <code className="text-xs">{m.kind}</code>
                  </td>
                  <td className="max-w-md truncate text-xs" title={m.body}>
                    {m.body.split("\n")[0]}
                  </td>
                  <td className="text-xs">{m.error ? <span className="text-red-700">{m.error}</span> : <span className="text-green-700">sent</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
