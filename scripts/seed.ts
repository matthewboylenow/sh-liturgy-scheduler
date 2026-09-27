/**
 * Seed the first admin, Saint Helen's ministries, and the weekend Mass pattern.
 * Safe to re-run: it skips anything that already exists.
 *
 *   ADMIN_EMAIL=matthew@sainthelen.org ADMIN_PHONE=9085550100 ADMIN_PASSWORD=... npm run seed
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "../src/db";
import { users, ministries, massTimes, positionTemplates } from "../src/db/schema";

const MINISTRIES = [
  { name: "Presider", shortName: "Presider", slug: "presider", color: "#6B21A8", sortOrder: 10, checkInEnabled: false, description: "Celebrant for the Mass" },
  { name: "Deacon", shortName: "Deacon", slug: "deacon", color: "#7E22CE", sortOrder: 15, checkInEnabled: false },
  { name: "Sacristans", shortName: "Sacristan", slug: "sacristan", color: "#1F346D", sortOrder: 20 },
  { name: "Lectors", shortName: "Lector", slug: "lector", color: "#0F766E", sortOrder: 30 },
  { name: "Extraordinary Ministers of Holy Communion", shortName: "EM", slug: "em", color: "#CD5334", sortOrder: 40 },
  { name: "Altar Servers", shortName: "Server", slug: "server", color: "#B45309", sortOrder: 50 },
  { name: "Ushers and Greeters", shortName: "Usher", slug: "usher", color: "#4D7C0F", sortOrder: 60 },
  { name: "Music Ministry", shortName: "Music", slug: "music", color: "#BE185D", sortOrder: 70, description: "Cantors and instrumentalists" },
  { name: "Media Ministry", shortName: "Media", slug: "media", color: "#0369A1", sortOrder: 80, description: "Livestream, slides, and sound" },
];

// Saturday = 6, Sunday = 0. The weekend pattern at Saint Helen (weekday and Saturday 9 am Masses are not scheduled here).
const MASS_TIMES = [
  { label: "Saturday 5:00 PM", dayOfWeek: 6, time: "17:00", sortOrder: 10 },
  { label: "Sunday 8:00 AM", dayOfWeek: 0, time: "08:00", sortOrder: 20 },
  { label: "Sunday 10:00 AM", dayOfWeek: 0, time: "10:00", sortOrder: 30 },
  { label: "Sunday 12:00 PM", dayOfWeek: 0, time: "12:00", sortOrder: 40 },
  { label: "Sunday 6:00 PM", dayOfWeek: 0, time: "18:00", sortOrder: 50 },
];

// Default positions per Mass, by ministry slug
const TEMPLATE: Record<string, number> = { presider: 1, sacristan: 1, lector: 2, em: 4, server: 3, usher: 4, music: 2, media: 1 };

async function main() {
  console.log("Seeding ministries...");
  for (const m of MINISTRIES) {
    const exists = await db.select({ id: ministries.id }).from(ministries).where(eq(ministries.slug, m.slug));
    if (!exists.length) await db.insert(ministries).values(m);
  }
  const allMin = await db.select().from(ministries);
  const bySlug = new Map(allMin.map((m) => [m.slug, m.id]));

  console.log("Seeding Mass times and position counts...");
  for (const t of MASS_TIMES) {
    const exists = await db.select().from(massTimes).where(eq(massTimes.label, t.label));
    const id = exists[0]?.id ?? (await db.insert(massTimes).values(t).returning())[0].id;
    for (const [slug, count] of Object.entries(TEMPLATE)) {
      const ministryId = bySlug.get(slug);
      if (!ministryId) continue;
      await db.insert(positionTemplates).values({ massTimeId: id, ministryId, count }).onConflictDoNothing();
    }
  }

  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const phoneRaw = process.env.ADMIN_PHONE?.replace(/\D/g, "");
  const phone = phoneRaw ? (phoneRaw.length === 10 ? `+1${phoneRaw}` : `+${phoneRaw}`) : null;
  const password = process.env.ADMIN_PASSWORD;
  if (email) {
    const exists = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (!exists.length) {
      await db.insert(users).values({
        firstName: process.env.ADMIN_FIRST ?? "Admin",
        lastName: process.env.ADMIN_LAST ?? "User",
        email,
        phone,
        role: "admin",
        status: "active",
        mfaRequired: true,
        emailVerified: true,
        phoneVerified: !!phone,
        passwordHash: password ? await bcrypt.hash(password, 12) : null,
      });
      console.log(`Created admin ${email}${password ? " with password" : " (sign in with a code)"}`);
    } else console.log(`Admin ${email} already exists`);
  } else {
    console.log("No ADMIN_EMAIL given; skipping admin creation.");
  }
  console.log("Done.");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
