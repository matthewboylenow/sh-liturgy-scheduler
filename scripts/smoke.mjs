/**
 * End-to-end smoke test. Runs the whole product once against a LOCAL database:
 * staff login (password + code), generate + publish 3 weeks, add a volunteer, accept invite,
 * sign up, passwordless login, kiosk key + tap check-in + fill-in picker, admin sees check-in, crons.
 *
 * Requirements (local only, never against Neon):
 *   - Postgres reachable by `psql` with DATABASE_URL matching (default below), migrated + seeded with
 *     ADMIN_EMAIL=matthew@sainthelen.org ADMIN_PASSWORD=password123
 *   - DEV_OTP_ECHO=true and the server started with its output going to SMOKE_LOG (codes are read from it):
 *       npm run build && PORT=3000 npm start > /tmp/next.log 2>&1 &
 *   - `npm i -D playwright` once (not in package.json on purpose; it is a dev-only tool)
 *
 *   SMOKE_LOG=/tmp/next.log PGURL="postgres://postgres@localhost:5433/liturgy" node scripts/smoke.mjs
 */
import { chromium } from "playwright";
import { execSync } from "child_process";
import fs from "fs";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const LOG = process.env.SMOKE_LOG ?? "/tmp/next.log";
const PGURL = process.env.PGURL ?? "postgres://postgres@localhost:5433/liturgy";
const log = () => fs.readFileSync(LOG, "utf8");
const lastCode = () => { const m = [...log().matchAll(/code is (\d{6})/g)]; return m.at(-1)?.[1]; };
const sql = (q) => execSync(`psql "${PGURL}" -tAc "${q.replace(/"/g, '\\"')}"`).toString().trim();

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const shots = process.env.SMOKE_SHOTS ?? "/tmp/smoke-shots"; fs.mkdirSync(shots, { recursive: true });
const shot = (n) => page.screenshot({ path: `${shots}/${n}.png`, fullPage: true });
const step = (s) => console.log("•", s);

// 1. Staff login: password then code
step("staff login");
await page.goto(`${BASE}/admin/login`);
await shot("01-admin-login");
await page.fill("#identifier", "matthew@sainthelen.org");
await page.fill("#password", "password123");
await page.click("button[type=submit]");
await page.waitForURL(/login\/verify/);
await shot("02-verify");
const code = lastCode(); if (!code) throw new Error("no OTP in log");
await page.fill("input[name=code]", code);
await page.click("button[type=submit]");
await page.waitForURL(/\/admin$/);
await shot("03-admin-overview");

// 2. Generate schedule for the next 3 weeks and publish
step("generate schedule");
await page.goto(`${BASE}/admin/schedule`);
const today = new Date(); const to = new Date(today.getTime() + 21 * 86400000);
const iso = (d) => d.toISOString().slice(0, 10);
const gen = page.locator("form").filter({ hasText: "Generate from the weekly pattern" });
await gen.locator("input[name=from]").fill(iso(today));
await gen.locator("input[name=to]").fill(iso(to));
await gen.locator("input[name=publish]").check();
await gen.locator("button[type=submit]").click();
await page.waitForURL(/admin\/schedule\?/);
await shot("04-schedule-generated");
const nMasses = sql("select count(*) from liturgies where status='published'");
console.log("  published masses:", nMasses);
if (Number(nMasses) < 6) throw new Error("expected masses");

// 3. Add a volunteer in EM + Lector and grab invite token from DB
step("add volunteer");
await page.goto(`${BASE}/admin/people`);
const add = page.locator("form").filter({ hasText: "Add a person" });
await add.locator("input[name=firstName]").fill("Mary");
await add.locator("input[name=lastName]").fill("Smith");
await add.locator("input[name=phone]").fill("(908) 555-0199");
await add.locator("input[name=email]").fill("mary@example.com");
await add.locator("label:has-text('Extraordinary Ministers') input").check();
await add.locator("label:has-text('Lectors') input").check();
await add.locator("button[type=submit]").click();
await page.waitForURL(/admin\/people\/[0-9a-f-]+/);
await shot("05-person");
const inviteUrl = [...log().matchAll(/https?:\/\/[^\s]+\/invite\/[A-Za-z0-9_-]+/g)].at(-1)?.[0];
if (!inviteUrl) throw new Error("no invite url in log");

// 4. Volunteer accepts invite in a fresh context, sets password
step("volunteer accepts invite");
const vctx = await browser.newContext({ viewport: { width: 420, height: 860 }, isMobile: true });
const v = await vctx.newPage();
await v.goto(inviteUrl.replace(/^https?:\/\/[^/]+/, BASE));
await v.screenshot({ path: `${shots}/06-invite.png`, fullPage: true });
await v.fill("input[name=password]", "marypass123");
await v.fill("input[name=confirm]", "marypass123");
await v.click("button[type=submit]");
await v.waitForURL(/\/app\?welcome=1/);
await v.screenshot({ path: `${shots}/07-volunteer-home.png`, fullPage: true });

// 5. Volunteer signs up for the first open EM slot
step("volunteer signs up");
await v.goto(`${BASE}/app/schedule`);
await v.screenshot({ path: `${shots}/08-schedule.png`, fullPage: true });
await v.locator("button:has-text('Sign up')").first().click();
await v.waitForURL(/ok=signed_up/);
await v.screenshot({ path: `${shots}/09-signed-up.png`, fullPage: true });
const nAssign = sql("select count(*) from assignments where status<>'declined'");
console.log("  assignments:", nAssign);
if (nAssign !== "1") throw new Error("expected 1 assignment");
// try a second sign-up at same mass should be blocked -> just check mine page shows it
await v.goto(`${BASE}/app/mine`);
await v.screenshot({ path: `${shots}/10-mine.png`, fullPage: true });

// 6. Volunteer passwordless login flow (sign out, text me a code)
step("volunteer code login");
await v.goto(`${BASE}/api/auth/logout`);
await v.goto(`${BASE}/login`);
await v.fill("#destination", "908-555-0199");
await v.click("button[type=submit]");
await v.waitForURL(/login\/verify/);
await v.fill("input[name=code]", lastCode());
await v.click("button[type=submit]");
await v.waitForURL(/\/app$/);
console.log("  code login ok");

// 7. Kiosk: create key, move Mary's mass to today, check in
step("kiosk");
await page.goto(`${BASE}/admin/kiosks`);
await page.locator("form").filter({ hasText: "Add a kiosk" }).locator("button").click();
await page.waitForURL(/newKey=/);
const key = new URL(page.url()).searchParams.get("newKey");
// move the liturgy Mary is on to today so it shows on the kiosk
const lid = sql("select l.id from assignments a join positions p on p.id=a.position_id join liturgies l on l.id=p.liturgy_id where a.status<>'declined' limit 1");
sql(`update liturgies set date=current_date, starts_at=now()+interval '1 hour' where id='${lid}'`);
const kctx = await browser.newContext({ viewport: { width: 1024, height: 600 } });
const k = await kctx.newPage();
await k.goto(`${BASE}/kiosk?key=${key}`);
await k.waitForURL(/\/kiosk$/);
await k.waitForSelector("button:has-text('Mary Smith')");
await k.screenshot({ path: `${shots}/11-kiosk.png` });
await k.click("button:has-text('Mary Smith')");
await k.click("button:has-text(\"Yes, I'm here\")");
await k.waitForSelector("text=checked in");
await k.waitForTimeout(1500);
await k.screenshot({ path: `${shots}/12-kiosk-checked-in.png` });
const checked = sql("select count(*) from assignments where checked_in_at is not null");
console.log("  checked in:", checked);
if (checked !== "1") throw new Error("check-in failed");
// fill-in flow on an open slot
await k.locator("button:has-text('Open')").first().click();
await k.waitForSelector("text=Who is covering");
await k.screenshot({ path: `${shots}/13-kiosk-fill.png` });

// 8. Admin liturgy detail shows check-in
await page.goto(`${BASE}/admin/schedule/${lid}`);
await shot("14-admin-liturgy");
const txt = await page.textContent("body");
if (!txt.includes("checked in")) throw new Error("admin page missing check-in");

// 9. Reminder cron
step("cron");
const r = await (await fetch(`${BASE}/api/cron/reminders`)).json();
console.log("  reminders:", JSON.stringify(r));
const o = await (await fetch(`${BASE}/api/cron/open-slots`)).json();
console.log("  open-slots digest:", JSON.stringify(o));

await browser.close();
console.log("ALL OK");
