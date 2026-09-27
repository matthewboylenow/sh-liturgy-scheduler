# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Volunteers in the weekend liturgy ministries at the Parish Community of Saint Helen in Westfield, NJ: extraordinary ministers, lectors, altar servers and their parents, sacristans, ushers, music and media ministry, plus the clergy who preside. Many are older and use a phone. A second group is staff and ministry coordinators (Director of Worship, Director of Communications, pastor) who build and fill the schedule. A third "user" is the sacristy touchscreen, operated by whoever walks past it before Mass.

## Product Purpose

Replace SignUpGenius for weekend Mass ministry scheduling and add a check-in system so the parish knows, at any moment, who is here for a given Mass and who has not shown up. Success: volunteers can claim slots in under a minute on a phone, coordinators can see coverage for the next month at a glance, and the sacristy screen shows real-time presence without anyone logging in.

## Positioning

A single parish-owned portal with no ads, no upsells, and no third-party dependence, tied to the parish's own SMS and email. Not a general church management system; TouchPoint remains the system of record for people and giving.

## Operating Context

Volunteers use it on phones, often on Saturday morning after a reminder text. Staff use it on desktops Monday through Wednesday. The kiosk is a Raspberry Pi with a 7 to 10 inch touchscreen in the sacristy, used in the ten minutes before each Mass. Network is parish Wi-Fi; the app is hosted on Vercel with a Neon database.

## Capabilities and Constraints

- Open sign-up model: staff publish Masses with position counts, volunteers claim slots only in ministries they belong to.
- Roles: volunteer, coordinator (scoped to their ministries), admin. Staff always get a texted code after their password. Microsoft 365 sign-in is staff-only.
- Notifications: SMS reminders two days out with YES/NO replies, email reminders, open-slot alerts to the ministry, daily digest.
- Kiosk: tap-your-name check-in, fill-in from the ministry roster, five-minute undo. No PIN, no login on the device.
- Constraints: no self-registration, volunteer names come from admin-managed rosters; no photos of minors on the kiosk; everything must be legible for older eyes.

## Brand Commitments

Saint Helen brand: Navy #1F346D, Rust #CD5334, Cream #FAF9F7, Gold #D4AF37; Libre Baskerville headings, Libre Franklin body. Tone is direct, short, and warm. No em dashes, no "excited", no "wonderful opportunity". Always "Saint Helen", never "St. Helen's".

## Evidence on Hand

- The built application under src/ (Next.js 16, Tailwind v4) with an end-to-end Playwright run covering login, scheduling, sign-up, and kiosk check-in.
- The existing WordPress site at sainthelen.org and the printed weekly bulletin for brand reference.
- Years of SignUpGenius usage informing the open-sign-up model.

## Product Principles

1. Obvious over clever. Every screen answers one question: what do I do here.
2. Phone first for volunteers, desktop first for staff, touch first for the kiosk. Do not compromise one for the others.
3. One accent per view. Rust means "the action", nothing else.
4. Legible for a 75 year old lector at 7:15 on a Sunday morning.
5. The parish owns it. No vendor branding, no ads, no dark patterns.
