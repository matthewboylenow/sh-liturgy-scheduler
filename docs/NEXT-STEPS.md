# Next steps

Status as of Sept 27, 2026 (evening): code is on GitHub (`matthewboylenow/sh-liturgy-scheduler`), a Vercel project exists and has deployed, the Neon integration is attached. The Neon database is migrated and seeded (see 1.2). No external services are wired yet, so nobody can receive a code; the first sign-in needs Resend, Twilio, or the `DEV_OTP_ECHO` stopgap. Everything below is in order. Each phase ends with a check you can actually run.

Phases 1 and 2 are things only Matthew can do (accounts, credentials, hardware). Phase 3 onward are things to hand to Claude Code one at a time; each bullet there is written so it can be pasted in as the task.

---

## Phase 1: make production sign-in work (Matthew, about an hour)

### 1.1 Environment variables on Vercel

Project → Settings → Environment Variables. Neon already set `DATABASE_URL`. Add, for Production (and Preview if you want preview deploys to work):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_APP_URL` | the real URL, e.g. `https://liturgy.sainthelen.org` or the `*.vercel.app` URL until DNS is set. Used in every text and email link and in the Microsoft redirect. No trailing slash. |
| `SESSION_SECRET` | `openssl rand -base64 32` |
| `CRON_SECRET` | `openssl rand -base64 32`. Vercel sends it automatically as `Authorization: Bearer` on cron calls. |
| `PARISH_NAME` | `Saint Helen` |
| `PARISH_TIMEZONE` | `America/New_York` |
| `DEV_OTP_ECHO` | leave unset in production |

Redeploy after adding (Deployments → ⋯ → Redeploy). Env changes do not apply to the running deployment.

### 1.2 Migrate and seed the Neon database (done Sept 27)

Done from a Claude Code session with the production `DATABASE_URL`:

- `npm run db:migrate` applied `drizzle/0000_initial.sql` (14 tables, journal row 1). The script now goes through the app's own driver (`scripts/migrate.ts`), so it works over Neon HTTP from networks where port 5432 is blocked. `npm run db:migrate:kit` is the old drizzle-kit path if you ever need it.
- `npm run seed` created the 9 ministries, 6 Mass times (Sat 5, Sun 7:30 / 9 / 10:30 / 12 / 5) with default position counts, and the admin account `matthew@sainthelen.org` (Matthew Boyle, role admin, active).
- The admin has **no password and no phone yet** on purpose (nothing secret had to pass through chat). Sign in at `/admin/login` on the "Text me a code" tab with the email address; the code goes by email. Then Profile → add a password and your mobile number.
- A staff sign-in by email code was exercised end to end against this database (with `DEV_OTP_ECHO=true`) and works. Two `otp_codes`, two `audit_log`, and two `notification_log` rows from that test remain; harmless.

If the pattern is different, fix Mass times and counts in Admin → Mass times. The seed is idempotent; re-running it never overwrites what is there.

To re-run any of this from your Mac later:

```bash
npm install
npx vercel env pull .env.production.local
export DATABASE_URL="$(grep ^DATABASE_URL .env.production.local | cut -d= -f2- | tr -d '"')"
npm run db:migrate
npm run seed
```

### 1.3 Twilio (needed before any staff can sign in, because staff always get a texted code)

1. Twilio console → buy a local number (908 area code if available) or use an existing one.
2. Messaging → register for A2P 10DLC as a sole proprietor or standard brand (the parish is a nonprofit; use the parish EIN). Until this is approved, texts to US numbers may be filtered or fail. Approval takes days, start it first.
3. Create a Messaging Service, add the number to it, note the `MG...` SID.
4. Under the Messaging Service → Integration → Incoming messages → "Send a webhook": `https://<app url>/api/twilio/inbound`, HTTP POST. This is what makes YES / NO replies work.
5. Vercel env: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`. (You can use `TWILIO_FROM_NUMBER` instead of the service SID, but a Messaging Service is what 10DLC wants.) Redeploy.

Check: open `/admin/login`, "Text me a code" tab, enter your email (or your mobile once it is on the account). You should get the six-digit code within seconds. Log → Texts and emails in the admin shows the send.

Stopgap while waiting on 10DLC: set `DEV_OTP_ECHO=true` in Vercel, redeploy, sign in, and read the code from Vercel → Logs. Remove it after.

### 1.4 Resend (email codes, invites, reminders)

1. resend.com → Domains → add `sainthelen.org` (or `mail.sainthelen.org` to keep DNS separate from HubSpot). Add the DKIM/SPF records it gives you at the DNS host.
2. API Keys → create one with sending access.
3. Vercel env: `RESEND_API_KEY`, `EMAIL_FROM="Saint Helen Liturgy <liturgy@sainthelen.org>"`. Redeploy.

Check: in the admin, add yourself as a second test person with a different email, tick "Send invite now". The invite email arrives and the link works.

### 1.5 Domain

Vercel → Domains → add `liturgy.sainthelen.org` (or whatever you pick), add the CNAME at the DNS host. Update `NEXT_PUBLIC_APP_URL` to match and redeploy. Do this before inviting anyone, because invite links and texts embed the URL.

---

## Phase 2: Microsoft 365 staff sign-in (Matthew, 20 minutes, optional for launch)

1. entra.microsoft.com → App registrations → New. Name "Saint Helen Liturgy". Supported account types: single tenant. Redirect URI (Web): `https://<app url>/api/auth/microsoft/callback`.
2. Certificates & secrets → New client secret (24 months). Copy the value now, it is shown once.
3. Overview → copy Application (client) ID and Directory (tenant) ID.
4. Vercel env: `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`. Redeploy.
5. The account that signs in must already exist in the app as admin or coordinator with the same email as their M365 login. It never creates accounts.

Check: `/admin/login` → "Sign in with Microsoft 365" → lands on `/admin`.

---

## Phase 3: real data (Matthew with Adrian, an afternoon)

1. Admin → Mass times: correct the weekend pattern. Delete or deactivate any seeded time that does not exist. Set position counts per Mass per ministry (the grid). Music ministry counts will differ by Mass.
2. Admin → Ministries: rename short names if the ministries use different terms, set colors, decide which are hidden from the kiosk (Presider is hidden by default).
3. Export the SignUpGenius roster (Reports → participants, or the People tab → export) and reshape it to `first,last,phone,email,ministries` with ministries as semicolon-separated short names. Admin → People → Import CSV. Leave "send invites" unchecked for the first import; review the People list; then invite one ministry at a time.
4. Admin → Schedule → Generate from the weekly pattern, through the end of Advent, as drafts. Open a few Masses, add the presider manually, fix holiday Masses (add single Masses for Christmas, Holy Days), then select and Publish.
5. Add yourself and Adrian as coordinators of Music (People → Adrian → tick "coord." next to Music).

Check: sign in as a volunteer test account on your phone, see only your ministries, claim a slot, get the confirmation. Sign in as admin, see it on the Mass page.

---

## Phase 4: the sacristy kiosk (Matthew, hardware)

Hardware that works: Raspberry Pi 4 or 5 with the official 7" touchscreen, or any 10" HDMI touch display; a small Intel NUC or old Mac mini with a touch monitor also works and is less fiddly. The app needs nothing on the device except a browser.

1. Admin → Kiosks → Add ("Sacristy"). Copy the one-time link.
2. On the device, open Chromium, visit that link once. It sets a cookie for a year and redirects to `/kiosk`.
3. Autostart in kiosk mode. On Raspberry Pi OS (Wayland/labwc), create `~/.config/labwc/autostart` with:
   ```
   chromium-browser --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --check-for-update-interval=31536000 https://<app url>/kiosk &
   ```
   Also disable screen blanking (raspi-config → Display → Screen Blanking → off) and set the display to stay on.
4. The board polls every 20 seconds. If the Wi-Fi drops it shows the error bar and recovers on its own.

Check: on the Sunday before launch, with a published Mass for that day, tap your own name and watch it turn green on the admin Mass page.

---

## Phase 5: pilot, then cut over

Week 1: one ministry (Music, since Adrian is the sponsor) uses the app for real while everyone else stays on SignUpGenius. Reminders on. Collect what confused people.
Week 2 to 3: add Lectors and EMs. Turn on the open-slot digest cron (it is already scheduled Tue/Fri; it just needs people in the ministries).
Week 4: everything, and stop creating new SignUpGenius sign-ups. Keep the old ones readable for a month.

Announce it: one bulletin blurb, one email blast item, a text via Text In Church to the ministry lists with the invite instruction. Volunteers do not need to "register"; they get a text with a link and tap it.

---

## Phase 6: backlog for Claude Code

Each item is a self-contained task. Start a Claude Code session in the repo and paste one in. It will read `CLAUDE.md`, `DESIGN.md`, and `PRODUCT.md` on its own. Ordered by value.

1. **Printable weekend sheet.** Add `/admin/schedule/print?from=&to=` that renders every published Mass in the range as a print-styled page (one Mass per block, ministries as columns, names, blank lines for open slots) with a "Print" button. Letter, portrait, black on white, Libre fonts, no chrome. This is for the sacristy wall and for people without phones.

2. **No-show alert to the coordinator.** New cron `/api/cron/no-shows` scheduled every 15 minutes on weekends (`vercel.json`): for any published Mass starting in the next 15 minutes, list live assignments with `checkedInAt` null in check-in-enabled ministries, and text each ministry's coordinators (and admins if the ministry has none) a single message per Mass: "10:30 Mass: not checked in yet: Mary Smith (EM), John Doe (Lector)". Send at most once per Mass per coordinator (log kind `no_show` in `notification_log`). Add a per-user opt-out flag `notifyNoShows` on users, default true for coordinators.

3. **Usual-Mass preferences and one-click fill.** Add `preferredMassTimeIds` (array) and `frequency` ("weekly" / "every other" / "monthly") to `ministry_members`. Volunteer profile gets a "Masses I usually serve" picker. Admin schedule page gets "Suggest assignments" for a Mass that fills open positions from members whose preference matches, least-recently-served first, and shows the suggestions for approval before assigning. Never auto-assign silently.

4. **Blackout dates.** Table `blackouts(userId, from, to, note)`. Volunteer profile: "Dates I'm away". Suggestion logic (item 3) and the open-slot digest skip people on blackout. Admin People page shows upcoming blackouts.

5. **Family grouping.** `households(id, name)` and `users.householdId`. A parent can sign up an altar server child from their own account (the child has no login). Kiosk fill-in picker and admin assign dropdown group household members. Reminders go to the household's adult.

6. **Swap requests between volunteers.** "Ask someone to swap" on an assignment: pick a member of the same ministry, they get a text with accept/decline links (signed tokens, no login needed). Accept moves the assignment. Expire after 48 hours.

7. **Volunteer-facing calendar feed.** `/api/ical/<token>` per user (token stored on users, regenerable from profile) returning their upcoming assignments as VEVENTs with the Mass time, ministry, and a link. Profile shows the subscribe URL with instructions for iPhone and Google Calendar.

8. **Coverage report.** `/admin/reports`: per ministry, per Mass time, fill rate and no-show rate over a date range, plus a "who served how often" table. Plain HTML tables, CSV download. Read DESIGN.md before adding any charts; if charts, use the `dataviz` skill.

9. **TouchPoint roster sync (read-only).** Nightly cron that pulls a TouchPoint SQL/CSV export from Vercel Blob (uploaded by an admin from the People → Import page) and adds new people as `invited` without sending invites, and flags people in the app who are no longer in TouchPoint. Do not delete or deactivate automatically.

10. **Hardening pass.** Run `/impeccable harden` on `/app/schedule`, `/app/liturgy/[id]`, and `/kiosk`: long names, 12 positions in one ministry, a Mass with no positions, a ministry with no members, network failure on the kiosk mid-check-in, a volunteer in zero ministries, expired invite, double-submit on Sign up. Then `/impeccable audit` for a11y and `/impeccable adapt` for the 7" kiosk at 1024x600.

11. **Rate limiting and abuse.** OTP issuance is throttled per destination (5 per 15 min) but login attempts are not. Add a per-IP and per-identifier attempt counter on `passwordLogin` (10 per 15 min) using a small `login_attempts` table or Vercel KV. Add `Retry-After` handling on the login page.

12. **Preview deployments with a seeded DB.** Neon branching: a GitHub Action that creates a Neon branch per PR, runs `db:migrate` and `seed` on it, and sets `DATABASE_URL` on the Vercel preview. Tear down on PR close.

---

## Known gaps and things to watch

- **Vercel crons and `CRON_SECRET`:** the cron routes return 401 if `CRON_SECRET` is set and the header does not match. Vercel adds the header automatically; hitting the URL in a browser will 401, which is correct.
- **Cron timing:** reminders run daily 17:00 UTC (1 pm EDT, noon EST) for Masses 36 to 60 hours out. In practice Thursday's run covers the Saturday vigil and Friday's run covers every Sunday Mass (morning and 5 pm); Saturday's run finds nothing on a normal weekend. Open-slot digest runs Tue and Fri 15:00 UTC for the next 10 days.
- **Timezone:** everything is America/New_York via `src/lib/time.ts`. `liturgies.startsAt` is UTC and is what the kiosk and crons compare against. If a Mass time is edited, `startsAt` is recomputed in `updateLiturgy`; if you ever bulk-edit rows in SQL, recompute it.
- **Neon HTTP driver has no transactions.** `claimPosition` relies on the partial unique index to prevent double booking. Keep multi-step writes idempotent.
- **`next start` stale build:** when testing production builds locally, kill the old `next-server` process before `npm start` or it silently serves the old build. This bit us once already.
- **Session cookies are 30 days.** Volunteers on shared devices should sign out; there is a Sign out button on every page. Kiosk cookie is 1 year and only unlocks kiosk routes.
- **Email fallback font** in `notify.ts` is Helvetica; Impeccable flags it, it is fine for email clients.
- **Presider is a ministry.** Clergy need accounts to be assignable; give them `notifySms` off if they do not want reminders. Or add them as `inactive` if they should never sign in (inactive users can still be assigned by staff).
- **CSV import** matches existing people by phone first, then email. Two people sharing a phone (spouses) will collide; import them with distinct emails or add the second by hand.
- **10DLC**: until Twilio approves the campaign, expect some carriers to drop texts. Have the email path configured as the fallback and encourage volunteers to keep email reminders on.

---

## Code review notes, Sept 27

From a read of every file plus a production build, lint, typecheck, and a browser run of staff sign-in against the Neon database. Lint is clean apart from one warning; `tsc` is clean; the build succeeds. Nothing here blocks launch. In rough priority order:

1. **Cron routes are public until `CRON_SECRET` is set.** The guard is `if (secret && ...)`; with the variable unset, `GET /api/cron/reminders` returned 200 to an anonymous request. Set the variable (Phase 1.1). Consider failing closed in production so a missing variable cannot silently expose the endpoints.
2. **`NEXT_PUBLIC_APP_URL` is load-bearing.** Unset, every invite and reminder link points at `http://localhost:3000`. It is also the URL Twilio signatures are checked against in `/api/twilio/inbound`, so the webhook URL configured in Twilio must be exactly this value plus the path (vercel.app vs custom domain matters). Set it before inviting anyone, and update it when the domain changes.
3. **Protocol-relative open redirect** (low). `safeNext` in the auth actions rejects `//host`, but three other places only check `startsWith("/")`: the `ms_next` cookie in `src/app/api/auth/microsoft/route.ts`, and the already-signed-in redirects in `src/app/(auth)/login/page.tsx` and `src/app/(auth)/admin/login/page.tsx`. `next=//evil.example` would redirect there. Reuse `safeNext`.
4. **No rate limit on password attempts** (backlog item 11). OTP verification caps at 5 attempts and issuance at 5 per 15 minutes per destination, which is good. `resendCode` will also issue an MFA code to any known destination without a pending ticket; the same throttle bounds it, but it is a small text-spam vector.
5. **Open-slot alert fan-out.** A drop or sub request within 10 days texts every active member of that ministry immediately (`notifyMinistryOpenSlot`). For a 40-person EM roster that is 40 texts per drop, and there is no per-user opt-out separate from all SMS. Before the pilot, decide whether this should go to coordinators only, or only to members who opted in, with the Tue/Fri digest covering everyone else.
6. **Reminder cron runtime.** `sendReminders` sends sequentially inside a 60-second function. At roughly 300 ms per message, about 100 assignments with both text and email is near the limit. It is idempotent (`reminderSentAt`), but there is only one run per day, so anything left over waits 24 hours. Batch the sends with `Promise.all` in groups, or add a second daily run.
7. **Fonts.** `src/app/layout.tsx` loads Libre Baskerville and Libre Franklin from Google Fonts with a `<link>`, which is the one lint warning. `next/font/google` self-hosts them and removes the third-party request; DESIGN.md still gets the same faces.
8. **Mass times grid overflow.** With nine ministries the position-count grid is wider than the card at 1280 px; Music and Media are only reachable by horizontal scroll. Consider hiding Presider and Deacon columns (their counts rarely change) or letting the grid wrap.
9. **Dead check** in `acceptInvite`: the `need_login_method` branch can never run because `need_contact` fires first. Harmless.
10. **Not verified here.** Twilio and Resend send paths, kiosk check-in, volunteer sign-up, and the crons with real data. `scripts/smoke.mjs` covers all of them but needs a local Postgres, which this environment did not have; run it once on your Mac before the pilot.

Why `.env.example` was missing: `.gitignore` had `.env*`, which also ignores `.env.example`, so the file existed only in the original session. `.gitignore` now has `!.env.example` and the file is committed.
