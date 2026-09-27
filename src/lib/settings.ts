import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, DEFAULT_SETTINGS, type AppSettings } from "@/db/schema";

export async function getSettings(): Promise<AppSettings> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.id, 1));
  return { ...DEFAULT_SETTINGS, ...(row?.data ?? {}), noShow: { ...DEFAULT_SETTINGS.noShow, ...(row?.data?.noShow ?? {}) } };
}

export async function saveSettings(data: AppSettings) {
  await db
    .insert(appSettings)
    .values({ id: 1, data, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.id, set: { data, updatedAt: new Date() } });
}
