/** Run a cron job locally: npm run cron:reminders / cron:open-slots */
import "dotenv/config";

async function main() {
  const which = process.argv[2];
  const { sendReminders, sendOpenSlotDigests } = await import("../src/lib/alerts");
  if (which === "reminders") console.log(await sendReminders());
  else if (which === "open-slots") console.log(await sendOpenSlotDigests());
  else console.log("usage: tsx scripts/run-cron.ts reminders|open-slots");
}
main().then(() => process.exit(0));
