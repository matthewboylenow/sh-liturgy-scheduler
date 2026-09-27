import { requireAdmin } from "@/lib/auth";
import { PageTitle } from "@/components/shell";
import { Flash } from "@/components/flash";
import { SubmitButton, Alert } from "@/components/ui";
import { importPeople } from "@/app/admin/actions";
import { db } from "@/db";
import { ministries } from "@/db/schema";

export const metadata = { title: "Import people" };

export default async function ImportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await requireAdmin();
  const mins = await db.select({ shortName: ministries.shortName }).from(ministries);
  return (
    <>
      <PageTitle title="Import people" subtitle="Paste a CSV exported from SignUpGenius or TouchPoint." />
      <Flash sp={sp} />
      {sp.problems && (
        <div className="mb-4">
          <Alert kind="warn">
            <pre className="whitespace-pre-wrap text-xs">{sp.problems}</pre>
          </Alert>
        </div>
      )}
      <form action={importPeople} className="card space-y-3 p-4">
        <p className="text-sm text-muted">
          Columns in order: <code>first, last, phone, email, ministries</code>. Ministries are short names separated by semicolons:{" "}
          {mins.map((m) => m.shortName).join(", ") || "(add ministries first)"}. A row that matches an existing phone or email adds ministries to that person instead of creating a duplicate.
        </p>
        <textarea
          name="csv"
          rows={14}
          className="input font-mono text-xs"
          placeholder={"first,last,phone,email,ministries\nMary,Smith,(908) 555-0101,mary@example.com,EM;Lector\nJohn,Doe,,john@example.com,Server"}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="sendInvite" /> Invite new people now
        </label>
        <SubmitButton pendingText="Importing">Import</SubmitButton>
      </form>
    </>
  );
}
