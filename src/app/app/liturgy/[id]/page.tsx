import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getLiturgy, liveAssignment } from "@/lib/schedule";
import { PageTitle } from "@/components/shell";
import { Alert } from "@/components/ui";
import { LiturgyCard } from "@/components/liturgy-card";
import { updateAssignment } from "@/app/app/actions";
import { fmtDateLong, fmtTime } from "@/lib/time";

export default async function LiturgyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const l = await getLiturgy(id);
  if (!l || (l.status !== "published" && user.role === "volunteer")) notFound();
  const mine = l.positions.map((p) => liveAssignment(p)).find((a) => a?.userId === user.id);
  const self = `/app/liturgy/${id}`;

  return (
    <>
      <PageTitle
        title={`${fmtDateLong(l.date)} · ${fmtTime(l.time)}`}
        subtitle={[l.title, l.location].filter(Boolean).join(" · ")}
        actions={
          <Link href="/app/schedule" className="btn-ghost">
            All Masses
          </Link>
        }
      />
      {sp.error && (
        <div className="mb-4">
          <Alert kind="error">{sp.error}</Alert>
        </div>
      )}
      {sp.ok && (
        <div className="mb-4">
          <Alert kind="success">Saved.</Alert>
        </div>
      )}
      {l.notes && (
        <div className="mb-4">
          <Alert kind="info">{l.notes}</Alert>
        </div>
      )}
      {mine && (
        <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 border-navy/30 p-4">
          <div className="text-sm">
            You are serving at this Mass.
            {mine.status === "sub_requested" && <span className="ml-2 text-yellow-800">Sub requested.</span>}
          </div>
          <div className="flex gap-2">
            {mine.status !== "confirmed" && mine.status !== "sub_requested" && (
              <form action={updateAssignment}>
                <input type="hidden" name="assignmentId" value={mine.id} />
                <input type="hidden" name="action" value="confirm" />
                <input type="hidden" name="return" value={self} />
                <button className="btn-primary px-3 py-1 text-xs">I&apos;ll be there</button>
              </form>
            )}
            {mine.status === "sub_requested" ? (
              <form action={updateAssignment}>
                <input type="hidden" name="assignmentId" value={mine.id} />
                <input type="hidden" name="action" value="undo_sub" />
                <input type="hidden" name="return" value={self} />
                <button className="btn-ghost px-3 py-1 text-xs">I can make it after all</button>
              </form>
            ) : (
              <form action={updateAssignment}>
                <input type="hidden" name="assignmentId" value={mine.id} />
                <input type="hidden" name="action" value="request_sub" />
                <input type="hidden" name="return" value={self} />
                <button className="btn-ghost px-3 py-1 text-xs">I need a sub</button>
              </form>
            )}
            <form action={updateAssignment}>
              <input type="hidden" name="assignmentId" value={mine.id} />
              <input type="hidden" name="action" value="drop" />
              <input type="hidden" name="return" value={self} />
              <button className="btn-danger px-3 py-1 text-xs">Drop</button>
            </form>
          </div>
        </div>
      )}
      <LiturgyCard liturgy={l} user={user} returnTo={self} />
    </>
  );
}
