---
version: 1
name: saint-helen-liturgy
description: A calm, trustworthy parish tool. Cream paper ground, navy as the structural color, a single rust accent for the one action that matters on each screen, and gold only for warnings. Libre Baskerville headings give it a printed-bulletin feel; Libre Franklin body keeps forms and tables quick to scan. Three surfaces, three densities. The volunteer portal is phone-first and spacious. The admin area is a desktop working tool. The kiosk is a dark navy board with huge touch targets for a 7 to 10 inch sacristy screen.

# Mirrors src/app/globals.css @theme. Change both together.
colors:
  navy: "#1F346D"          # structure: nav, primary buttons, headings, kiosk ground
  navy-dark: "#172752"     # primary button hover
  navy-light: "#2C4A95"    # reserved, rarely used
  rust: "#CD5334"          # the accent. Sign up buttons, open-slot counts, staff links, one per view
  rust-dark: "#B1452A"     # accent hover
  cream: "#FAF9F7"         # page canvas
  gold: "#D4AF37"          # warnings and "needs a sub" only; never decoration
  ink: "#1C1C1C"           # body text
  muted: "#6B6B6B"         # captions, meta, table headers
  line: "#E6E2DC"          # hairlines, card borders (warm, not gray)
  surface: "#FFFFFF"       # cards, inputs, tables
  success: "#15803D"       # green-700 for checked in, filled, confirmed
  danger: "#B91C1C"        # red-700 text on white for destructive buttons

typography:
  display:
    fontFamily: "'Libre Baskerville', Georgia, serif"
    fontSize: 30px
    fontWeight: 400
    lineHeight: 1.2
  heading:
    fontFamily: "'Libre Baskerville', Georgia, serif"
    fontSize: 20px
    fontWeight: 400
    lineHeight: 1.3
  body:
    fontFamily: "'Libre Franklin', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  small:
    fontFamily: "'Libre Franklin', sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
  caption:
    fontFamily: "'Libre Franklin', sans-serif"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
  kiosk-clock:
    fontFamily: "'Libre Baskerville', Georgia, serif"
    fontSize: 36px
    fontWeight: 400
  kiosk-name:
    fontFamily: "'Libre Franklin', sans-serif"
    fontSize: 18px
    fontWeight: 500

spacing:
  base: 4px
  gutter: 16px
  card-padding: 16px
  section: 24px
  container: 1152px

rounded:
  sm: 6px       # buttons, inputs, alerts
  md: 8px       # cards
  lg: 12px      # kiosk tiles
  xl: 16px      # kiosk modal
  full: 9999px  # pills

elevation:
  card: "0 1px 2px rgba(0,0,0,.05)"
  modal: "0 25px 50px -12px rgba(0,0,0,.25)"

motion:
  fast: 150ms
  easing: "ease"
---

## Overview

This is a working tool for a parish, not a marketing site. People open it on a phone on Saturday morning to claim a lector slot, or on a desktop on Monday to fill next month's schedule, or they walk past a touchscreen in the sacristy and tap their name. Every surface is in Operate mode. Nothing here needs to persuade; it needs to be obvious.

The canvas is warm cream, not white, so white cards read as paper on a desk. Navy carries all structure: the header, headings, primary buttons, and the whole kiosk background. Rust is the one accent and it is rationed: the sign-up button, the count of open slots, the staff link. If a screen has two rust elements, one of them is wrong. Gold exists only to mean "attention needed" (a sub request, a warning), never as decoration. Green means done or present. Red is reserved for destructive buttons and errors.

Headings are Libre Baskerville at regular weight. They are never bold; the serif itself carries the weight. Body, labels, tables, and buttons are Libre Franklin. This pairing is meant to echo the printed bulletin without feeling like a brochure.

**Key characteristics:**
- Cream canvas, white cards with a warm hairline border, one shadow tier. Depth comes from borders, not shadows.
- Navy is structure, rust is the single action, gold is a warning, green is done. No other hues.
- Serif headings at regular weight, sans everything else. No decorative bold.
- Ministry identity comes from small colored pills with short names (EM, Lector, Server), never from colored panels.
- Three densities: volunteer (spacious, phone-first), admin (dense tables, desktop-first, still usable on a phone), kiosk (huge, dark, no chrome).

## Colors

### Brand and accent
- **Navy** (`{colors.navy}`): header wordmark, page titles, primary buttons, focus rings at 40% alpha, kiosk ground. Never as a large fill inside the volunteer or admin pages other than buttons.
- **Rust** (`{colors.rust}`): the accent. Sign up and Take it buttons, the open-slot stat, "Admin" links from the volunteer view, the "Assign" link on the overview. Budget: one rust call to action per card, one per viewport if you can.
- **Gold** (`{colors.gold}`): only for "needs a sub" pills (30% tint background, dark yellow text), warning alerts, and the dashed open-slot outline on the kiosk. It never fills a button.

### Surface
- **Cream** (`{colors.cream}`): body background. Also the hover background for ghost buttons and the kiosk fill-in picker buttons.
- **Surface** (`{colors.surface}`): cards, inputs, table bodies, modal bodies.
- **Line** (`{colors.line}`): every border. It is warm, so do not swap in Tailwind gray borders.

### Text
- **Ink** (`{colors.ink}`) for body. **Muted** (`{colors.muted}`) for captions, meta lines under names, table headers (uppercase, tracked). Muted on cream is 4.9:1. Do not put muted text on navy; use white at 60% instead.

### Semantic
- Success green: checked in, confirmed, all slots filled, verified. Pill: green-100 background, green-800 text.
- Danger red: Drop, Remove, Delete buttons (white fill, red-300 border, red-700 text), error alerts.
- Status pills map: signed_up navy tint, confirmed green, sub_requested gold, declined gray, draft gray, published green, cancelled red, invited gold, active green, inactive gray.

## Typography

- Page title: `{typography.display}` in navy, followed by a one-line `{typography.small}` muted subtitle that says what to do here.
- Card and section titles: `{typography.heading}`.
- Everything interactive is `{typography.small}` at weight 600 for buttons, 500 for labels.
- Table headers: `{typography.caption}` uppercase, tracked, muted.
- Dates read "Sun, Oct 4 · 10:30 AM" with a middle dot, and they never wrap. Use `whitespace-nowrap` on any date-time string in a table cell.
- No em dashes anywhere. Use a period, a comma, or a middle dot.
- Webfonts load from Google Fonts. Fallback stack is Georgia / system sans, and the layout must still hold if the webfont fails.

## Layout

- 4px base. Card padding 16px. Gaps between cards 16px. Section gap 24px. Page gutter 16px on phone.
- Container max 1152px, centered. Two-column layouts are `lg:grid-cols-3` with the working area spanning two and a sidebar form in the third; below `lg` they stack, sidebar last.
- Header: white, hairline bottom, wordmark left, nav center on desktop, user and sign out right. On phone the nav becomes a horizontally scrolling row under the header.
- Volunteer schedule groups Masses under "Weekend of October 4" headers in muted uppercase caption style; Masses are two-up on desktop, one-up on phone.

## Elevation and depth

- Cards: hairline border plus `{elevation.card}`. That is the only shadow in the volunteer and admin areas.
- Kiosk panels: navy ground with white at 5% for ministry groups and white tiles for people. No shadows on the kiosk; contrast does the work.
- Modals: black scrim at 50%, white body, `{rounded.xl}`, `{elevation.modal}`.

## Components

### Buttons
Height 36px (py-2), `{rounded.sm}`, weight 600, 14px. Four kinds: primary (navy, white text), accent (rust, white text, for sign-up actions only), ghost (white, hairline, ink text, cream hover), danger (white, red border and text). Small variant is px-2.5 py-1 text-xs inside table rows. Disabled at 50% opacity. Kiosk buttons are a separate species: min height 68px, 18px text, `{rounded.lg}`.

### Inputs
White, hairline border, `{rounded.sm}`, 16px text so iOS does not zoom, navy focus ring at 40%. Labels above, 14px weight 500. Helper text below in caption muted.

### Cards
White, hairline, `{rounded.md}`. A card with a header gets a cream/60 header strip with a hairline under it. Never nest a card in a card; use a bordered row (`border border-line/70`) inside a card instead.

### Ministry pill
`{rounded.full}`, 12px weight 500, white text on the ministry's own color, short name only. The ministry color is data, not theme, and it is the only place arbitrary hues appear.

### Status pill
Same shape, tinted background with dark text, lowercase, underscores replaced with spaces.

### Tables
Full width, 14px, header caption style, hairline row dividers at 70% opacity. On phone the table stays a table inside an `overflow-x-auto` card rather than collapsing into cards, because staff need to scan columns.

### Alerts
`{rounded.sm}`, 14px, tinted border and background: info navy/5, success green-50, warning gold/10, error red-50.

### Kiosk board
Navy ground, white header text, clock in `{typography.kiosk-clock}`. Mass tabs are rounded-xl chips, the active one white on navy. Ministry groups are white/5 panels. A person tile is white with navy text and "Tap to check in" on the right; once checked in it turns solid green with a check mark and is disabled. Open slots are dashed gold outlines reading "Open. Tap to fill in." Toasts are white pills at the bottom center with an Undo link in rust.

## Motion

- Buttons and tiles: 150ms ease on background. Kiosk tiles scale to 0.99 on press.
- Nothing else animates. No page transitions, no skeleton shimmer, no bouncing. The kiosk refreshes data every 20 seconds silently.
- Respect `prefers-reduced-motion` if any motion is ever added.

## Responsive behavior

- Phone (390px) is the primary volunteer width. Everything must work one-handed: 44px touch targets, sign-up buttons on the right edge of each row.
- Admin is designed at 1280px and must remain usable at 390px by scrolling tables horizontally, never by hiding columns silently.
- Kiosk is designed at 1024x600 (7 inch) through 1920x1080. Three ministry columns at xl, two at md, one below. No hover states matter there.
- The header nav collapses to a scrolling row below md.

## Voice and copy

Direct, short, warm. "You are signed up. Thank you." not "Your registration has been successfully submitted." Say "Mass" not "event", "slot" not "opportunity", "sub" not "substitute volunteer". Never "excited", "wonderful opportunity", "we look forward to". The parish is "Saint Helen", never "St. Helen's". No em dashes.

- Empty state: "You are not signed up for anything yet. See open slots."
- Error: "That code is not right. Check it and try again."
- Confirmation: "Mary Smith checked in. Thank you!"

## Do and don't

**Do**
- Keep one rust action per card.
- Use the ministry pill for ministry identity everywhere, including the kiosk dot.
- Show counts as "3/4" with the filled number first.
- Keep dates on one line.

**Don't**
- Don't introduce gray borders, blue links, or a second accent.
- Don't bold serif headings.
- Don't nest cards or add shadows to make things "pop".
- Don't put muted gray text on navy.
- Don't add motion to the kiosk beyond the press state.

## Known gaps

- Dark mode is not designed; the kiosk is dark by intent, the rest is light only.
- Print styles for a sacristy wall sheet are not designed yet.
- Email templates use a simpler inline style set (navy header bar, white body, Helvetica fallback) and are not covered here.
