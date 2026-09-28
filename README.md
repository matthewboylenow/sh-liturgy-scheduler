# Saint Helen Liturgy Scheduler

Weekend liturgy ministry scheduling and sacristy check-in for the Parish Community of Saint Helen. Replaces SignUpGenius.

Next.js 16 (App Router, server actions), TypeScript, Tailwind v4, Drizzle ORM on Neon Postgres, Vercel. Twilio for texts, Resend for email, Microsoft Entra ID for staff sign-in.

## What it does

**Volunteers** (`/app`) sign in with a texted code or a password, see the published Masses, and claim open slots in the ministries they belong to. They can confirm, ask for a sub, or drop. Reminders go out two days before with reply YES / NO handling.

**Staff and coordinators** (`/admin`) manage people and ministries, define the weekly Mass pattern with position counts, generate a schedule for a date range, fill gaps by hand, and publish. Coordinators only see and manage their own ministries. Admins get everything plus kiosks and logs.

**Kiosk** (`/kiosk`) is the sacristy touchscreen. It shows today's Masses with everyone scheduled. Tap your name to check in. Open or sub-needed slots can be filled on the spot from the ministry roster. No login on the device; it is keyed once with a link from Admin → Kiosks.

## Roles

| Role | Can |
|---|---|
| volunteer | sign up only for their own ministries |
| coordinator | everything a volunteer can, plus add people to and manage slots for ministries they coordinate |
| admin | everything |

Staff (admin, coordinator) always get a texted code after their password. Volunteers can turn that on for themselves. Microsoft 365 sign-in is staff-only and only matches an account an admin has already created (by email or Entra object id).

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in at least DATABASE_URL and SESSION_SECRET
npm run db:migrate           # applies ./drizzle migrations
ADMIN_EMAIL=you@sainthelen.org ADMIN_PHONE=9085550100 ADMIN_PASSWORD=changeme ADMIN_FIRST=Matthew ADMIN_LAST=Boyle npm run seed
npm run dev
```

With `DEV_OTP_ECHO=true` and no Twilio/Resend keys, codes and invite links print to the terminal instead of sending.

`DATABASE_URL` pointing at Neon uses the serverless HTTP driver; any other Postgres URL uses node-postgres, so a local Postgres works for development.

## Deploying to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Add the **Neon** integration (sets `DATABASE_URL`).
3. Set the rest of the env vars from `.env.example`. Generate `SESSION_SECRET` and `CRON_SECRET` with `openssl rand -base64 32`.
4. Run the migration once against the Neon database: `DATABASE_URL=... npm run db:migrate`, then `npm run seed` with the `ADMIN_*` vars to create yourself.
5. `vercel.json` schedules two crons: reminders daily at 17:00 UTC (1 pm Eastern) and open-slot digests Tuesday and Friday at 15:00 UTC. Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.

### Twilio
- Buy a number or set up a Messaging Service. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and either `TWILIO_FROM_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID`.
- Point the number's inbound webhook (HTTP POST) at `https://<your-domain>/api/twilio/inbound` so YES / NO replies work.
- For a US long code you will need A2P 10DLC registration before texts deliver reliably.

### Resend
- Verify `sainthelen.org` (or a subdomain) in Resend and set `RESEND_API_KEY` and `EMAIL_FROM`.

### Microsoft 365 (staff sign-in)
- In Entra admin center, register an app. Redirect URI (Web): `https://<your-domain>/api/auth/microsoft/callback`.
- Add a client secret. Set `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`.
- Only accounts already created here as admin or coordinator can sign in this way.

### Kiosk on a Raspberry Pi
- Admin → Kiosks → Add. Copy the one-time link.
- On the Pi, open that link in Chromium once; the key is stored in a cookie for a year.
- Autostart Chromium in kiosk mode, e.g. `chromium-browser --kiosk --noerrdialogs --disable-infobars https://<your-domain>/kiosk`.
- The board refreshes itself every 20 seconds. Check-ins can be undone from the kiosk within 5 minutes; staff can undo any time from the Mass page.

## Project layout

```
src/db/schema.ts        tables and relations
src/lib/auth.ts         sessions, passwords, one-time codes, invites, role helpers
src/lib/microsoft.ts    Entra ID OIDC
src/lib/schedule.ts     claiming, dropping, coverage, queries
src/lib/alerts.ts       reminders, open-slot alerts and digests
src/lib/kiosk.ts        kiosk auth and today's board
src/app/(auth)          login, verify, invite pages
src/app/app             volunteer portal
src/app/admin           staff area
src/app/kiosk           touchscreen board
src/app/api             Microsoft OAuth, kiosk API, crons, Twilio webhook
scripts/seed.ts         ministries, Mass times, first admin
drizzle/                SQL migrations
```

## Data model in one breath

`massTimes` is the weekly pattern (Sunday 10:30). `positionTemplates` says how many of each ministry that Mass time needs. Generating creates `liturgies` (a real Mass on a real date) and `positions` (one row per seat). A volunteer claiming a seat creates an `assignments` row; a partial unique index guarantees one live assignment per seat even under a race. `checkedInAt` on the assignment is the check-in. Presider and Deacon are ministries too, so clergy appear on the same schedule.

## Things left for later

- Recurring "I usually do the 10:30" preferences and auto-fill from them.
- Blackout dates per volunteer.
- Export a printable weekend sheet (PDF) for the sacristy wall.
- TouchPoint sync for the roster (CSV import covers it for now).
- Family grouping so a parent and kids sign up together.
