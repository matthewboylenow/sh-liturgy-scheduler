/**
 * Apply ./drizzle migrations to DATABASE_URL. Same journal table as `drizzle-kit migrate`,
 * but picks the driver the way src/db does: Neon HTTP for neon.tech URLs (works from networks
 * where TCP 5432 is blocked, such as CI or a Vercel build), node-postgres for anything else.
 *
 *   DATABASE_URL=... npm run db:migrate
 */
import "dotenv/config";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const folder = "./drizzle";
  if (/neon\.tech/.test(url) || process.env.DB_DRIVER === "neon") {
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    const { migrate } = await import("drizzle-orm/neon-http/migrator");
    await migrate(drizzle(neon(url)), { migrationsFolder: folder });
  } else {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const db = drizzle(url);
    await migrate(db, { migrationsFolder: folder });
    await db.$client.end();
  }
  console.log("Migrations applied.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
