import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageTitle } from "@/components/shell";
import { Flash } from "@/components/flash";
import { SubmitButton } from "@/components/ui";
import { saveNoShowSettings } from "@/app/admin/actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await requireAdmin();
  const { noShow } = await getSettings();
  const hours = Math.floor(noShow.offsetMinutes / 60);
  const minutes = noShow.offsetMinutes % 60;
  return (
    <>
      <PageTitle title="Settings" />
      <Flash sp={sp} />
      <form action={saveNoShowSettings} className="card max-w-xl space-y-4 p-4">
        <div>
          <h2 className="text-lg">No-show alert</h2>
          <p className="text-sm text-muted">Tells each ministry lead who has not checked in at the kiosk. Admins get it for ministries with no lead. Once per Mass.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="enabled" defaultChecked={noShow.enabled} /> On
        </label>
        <fieldset className="space-y-2 text-sm">
          <legend className="label">Send by</legend>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="sms" defaultChecked={noShow.sms} /> Text
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="email" defaultChecked={noShow.email} /> Email
          </label>
        </fieldset>
        <fieldset className="space-y-2 text-sm">
          <legend className="label">When</legend>
          <div className="flex flex-wrap items-center gap-2">
            <select name="when" className="input w-auto" defaultValue={noShow.when}>
              <option value="before">Before Mass starts</option>
              <option value="after">After Mass starts</option>
            </select>
            <input type="number" name="hours" min={0} max={12} defaultValue={hours} className="input w-20" aria-label="Hours" /> h
            <input type="number" name="minutes" min={0} max={59} defaultValue={minutes} className="input w-20" aria-label="Minutes" /> min
          </div>
          <p className="text-xs text-muted">The check runs every 15 minutes on Saturdays and Sundays, so the alert lands within 15 minutes of the time you set. Someone marked &quot;needs a sub&quot; is not counted.</p>
        </fieldset>
        <SubmitButton>Save</SubmitButton>
      </form>
    </>
  );
}
