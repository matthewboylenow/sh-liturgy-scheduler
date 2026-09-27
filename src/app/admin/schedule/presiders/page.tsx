import Link from "next/link";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/db";
import { presiderImports } from "@/db/schema";
import { env } from "@/lib/env";
import { PageTitle } from "@/components/shell";
import { Flash } from "@/components/flash";
import { Alert, SubmitButton } from "@/components/ui";
import { uploadPresiderSchedule } from "@/app/admin/actions";
import { fmtInstant } from "@/lib/time";

export const metadata = { title: "Presider schedule" };

export default async function PresidersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await requireAdmin();
  const imports = await db.select().from(presiderImports).orderBy(desc(presiderImports.createdAt)).limit(20);
  const ready = Boolean(env.anthropicKey());

  return (
    <>
      <PageTitle
        title="Presider schedule"
        subtitle="Upload the celebrant schedule PDF. Weekend Masses in it get their presider; weekday and Saturday morning Masses are ignored."
        actions={
          <Link href="/admin/schedule" className="btn-ghost">
            Schedule
          </Link>
        }
      />
      <Flash sp={sp} />
      {!ready && (
        <div className="mb-4">
          <Alert kind="warn">Reading PDFs needs the ANTHROPIC_API_KEY environment variable. Add it in Vercel and redeploy.</Alert>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <form action={uploadPresiderSchedule} className="card space-y-3 p-4 self-start">
          <h2 className="text-lg">Upload</h2>
          <input type="file" name="pdf" accept="application/pdf,.pdf" className="input" required />
          <p className="text-xs text-muted">You review every Mass before anything is written. Nothing is published.</p>
          <SubmitButton pendingText="Reading the PDF" >Read PDF</SubmitButton>
        </form>

        <div className="card lg:col-span-2">
          <div className="border-b border-line px-4 py-2 font-semibold">Uploads</div>
          <table className="table">
            <thead>
              <tr>
                <th>File</th>
                <th>Uploaded</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link href={`/admin/schedule/presiders/${i.id}`} className="font-medium hover:underline">
                      {i.fileName}
                    </Link>
                    <div className="text-xs text-muted">
                      {i.payload.rows[0]?.date} to {i.payload.rows.at(-1)?.date} · {i.payload.rows.length} Masses
                    </div>
                  </td>
                  <td className="whitespace-nowrap text-xs text-muted">{fmtInstant(i.createdAt)}</td>
                  <td className="text-xs">{i.appliedAt ? <span className="text-green-700">Applied. {i.summary}</span> : <span className="text-rust">Waiting for review</span>}</td>
                </tr>
              ))}
              {imports.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-muted">
                    No uploads yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
