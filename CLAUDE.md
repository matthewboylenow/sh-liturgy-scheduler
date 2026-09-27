@AGENTS.md

# Saint Helen Liturgy: project notes for Claude Code

Weekend liturgy ministry scheduling and sacristy check-in for the Parish Community of Saint Helen (Westfield, NJ). Replaces SignUpGenius. Owner: Matthew Boyle (Director of Communications, also builds it). Stakeholder: Adrian Soltys, Director of Worship, who wants the sacristy kiosk.

Read `docs/NEXT-STEPS.md` for what is done and what is next. Read `DESIGN.md` before any UI change and `PRODUCT.md` for audience and constraints. Both outrank your own taste.

## Stack

Next.js 16 (App Router, server actions, `proxy.ts` not `middleware.ts`, async `params`/`cookies()`), TypeScript strict, Tailwind v4 (`@theme` in `src/app/globals.css`, no config file), Drizzle ORM, Neon Postgres in production via `@neondatabase/serverless` HTTP driver, node-postgres for any non-Neon `DATABASE_URL` (local dev). Twilio (SMS), Resend (email), hand-rolled Entra ID OIDC. Deployed on Vercel from `main`. No next-auth, no Prisma, no shadcn CLI; do not add them.

## Commands

```
npm run dev                 # local dev
npm run build && npm start  # production parity (kill the old next-server before restarting; a stale one serves the old build)
npm run lint                # eslint, must be clean
npx tsc --noEmit            # must be clean
npm run db:generate         # after ANY change to src/db/schema.ts: writes drizzle/*.sql. Commit the SQL.
npm run db:migrate          # applies drizzle/ to DATABASE_URL through the app's driver (Neon HTTP or node-postgres); db:migrate:kit is the drizzle-kit equivalent
npm run seed                # ministries, Mass times, position templates, first admin (ADMIN_* env vars). Idempotent.
npm run cron:reminders      # run a cron locally
npm run cron:open-slots
node scripts/smoke.mjs      # full end-to-end run against a local Postgres (see header of the file)
```

Never run `db:push` or `db:migrate` against Neon casually. Schema changes go: edit `schema.ts` -> `db:generate` -> review the SQL -> commit -> `db:migrate` with the production URL, once, deliberately.

## Where things live

```
src/db/schema.ts        every table. Read it first for any data question.
src/lib/auth.ts         sessions (cookie sh_session, hashed token in DB), passwords (bcrypt), OTP codes, invites, requireUser/requireStaff/requireAdmin/canManageMinistry
src/lib/microsoft.ts    Entra ID authorization-code + PKCE; matches existing staff by entraOid or email only
src/lib/schedule.ts     getLiturgies (relational query), claimPosition, changeAssignment, coverage, ScheduleError
src/lib/alerts.ts       notifyMinistryOpenSlot, sendReminders, sendOpenSlotDigests
src/lib/notify.ts       sendSms / sendEmail with notification_log rows; DEV_OTP_ECHO prints instead of sending
src/lib/kiosk.ts        kiosk cookie sh_kiosk, kioskToday() shape
src/lib/time.ts         everything timezone. Dates are YYYY-MM-DD local strings, times "HH:mm", startsAt is UTC computed with America/New_York.
src/app/(auth)/         login, verify, invite pages + actions.ts
src/app/app/            volunteer portal + actions.ts
src/app/admin/          staff area + actions.ts (one big file, grouped by section)
src/app/kiosk/          board.tsx is the only client component of size
src/app/api/            microsoft oauth, kiosk json api, cron routes, twilio inbound webhook
src/components/         shell (header/nav/pills), liturgy-card (the sign-up card), ui (SubmitButton, Alert, ConfirmButton), login-form, flash
scripts/                seed.ts, run-cron.ts, smoke.mjs
drizzle/                migrations. 0000_initial.sql is the baseline.
vercel.json             two crons
```

## Rules of the codebase

- Data model in one sentence: `massTimes` (weekly pattern) + `positionTemplates` (counts) generate `liturgies` (dated Masses) with `positions` (one row per seat); a volunteer claiming a seat creates an `assignments` row; a partial unique index (`status <> 'declined'`) guarantees one live assignment per seat. Presider and Deacon are ministries. `checkedInAt` on the assignment is the check-in.
- Authorization lives in server actions and lib, not in `proxy.ts`. `proxy.ts` only bounces missing-cookie requests to the right login page. Every action calls `requireUser`/`requireStaff`/`requireAdmin` and, for ministry-scoped work, `canManageMinistry`.
- Volunteers only ever see sign-up buttons for `user.ministryIds`. Coordinators only manage `user.coordinatorOf`. Keep it that way.
- Mutations are server actions that `redirect()` back with `?ok=` or `?error=` in the query string; pages render them through `<Flash>` or `<Alert>`. No client state libraries.
- `db` is a lazy Proxy so importing it never fails at build. Neon HTTP driver has no interactive transactions; rely on unique indexes and single statements for atomicity (claimPosition already does).
- Email/SMS copy lives next to the code that sends it. Keep it short. No em dashes anywhere, in UI or messages. "Saint Helen", never "St. Helen's". "Mass", "slot", "sub".
- Staff (admin, coordinator) always get an OTP after password. Do not add a bypass.
- Kiosk routes authenticate with the `sh_kiosk` cookie only and are limited to today's published Masses. Do not widen that.

## Verification standard

UI work is not done until it has been opened in a real browser with `playwright-cli` at desktop and 390px, interacted with, screenshotted, and looked at. Follow the `frontend-loop` skill. Run `npm run lint` and `npx tsc --noEmit` before every commit. For anything touching sign-up, check-in, or auth, run `node scripts/smoke.mjs` against a local Postgres.

## Environment

See `.env.example`. Local dev uses `.env.local` with a local Postgres URL and `DEV_OTP_ECHO=true` so codes print to the terminal. Never commit `.env*`. Never set `DEV_OTP_ECHO=true` in Vercel production for longer than a debugging session; it writes codes to the function logs.
