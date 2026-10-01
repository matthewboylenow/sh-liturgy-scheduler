---
version: 1
name: saint-helen-liturgy
description: The parish website, sainthelen.org, carried into a tool. Warm off-white ground, navy as the structural color, a single rust accent for the one action that matters on each screen, gold only for warnings. Bold Libre Baskerville headings, a small tracked uppercase eyebrow above them, soft-shadowed cards with 16px corners, and buttons that lift a pixel on hover, all lifted from the site. Three surfaces, three densities. The volunteer portal is phone-first and sized for ages 18 to 99. The admin area is a desktop working tool. The kiosk is a dark navy board with huge touch targets for a 7 to 10 inch sacristy screen.

# Mirrors src/app/globals.css @theme. Change both together.
colors:
  navy: "#1F346D"          # structure: nav, primary buttons, headings, kiosk ground
  navy-dark: "#162849"     # primary button hover (site hover value)
  navy-light: "#2C4A95"    # reserved, rarely used
  rust: "#CD5334"          # the accent. Sign up buttons, open-slot counts, staff links, one per view
  rust-dark: "#B84829"     # accent hover (site hover value)
  cream: "#F7F5F1"         # page canvas
  sand: "#EFEBE4"          # segmented controls, date tiles, grid header, full/away cells
  teal: "#17BEBB"          # site palette, reserved
  gold: "#D4AF37"          # warnings and "needs a sub" only; never decoration
  ink: "#0E0E0E"           # body text (site value)
  muted: "#5F6368"         # captions, meta, table headers
  line: "#E3DFD8"          # hairlines, card borders (warm, not gray)
  surface: "#FFFFFF"       # cards, inputs, tables
  success: "#15803D"       # green-700 for checked in, filled, confirmed
  danger: "#B91C1C"        # red-700 text on white for destructive buttons

typography:
  display:
    fontFamily: "'Libre Baskerville', Georgia, serif"
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.2
  heading:
    fontFamily: "'Libre Baskerville', Georgia, serif"
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.3
  eyebrow:
    fontFamily: "'Libre Franklin', sans-serif"
    fontSize: 12px
    fontWeight: 600
    letterSpacing: 0.12em
    textTransform: uppercase
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
  sm: 8px       # buttons, inputs, alerts, grid cells
  md: 12px      # kiosk tiles, date tiles
  lg: 16px      # cards, bands, sheets
  xl: 16px      # kiosk modal
  full: 9999px  # pills

elevation:
  card: "0 4px 20px rgba(31,52,109,.07)"
  button: "0 1px 4px rgba(0,0,0,.08)"
  button-hover: "0 2px 8px rgba(0,0,0,.12)"
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
- **Cream** (`{colors.cream}`): body background. Also the hover background for list rows.
- **Sand** (`{colors.sand}`): the one step darker. Segmented controls, the date tile on a Mass card, the sign-up grid header, and full or away grid cells.
- **Surface** (`{colors.surface}`): cards, inputs, table bodies, modal bodies.
- **Line** (`{colors.line}`): every border. It is warm, so do not swap in Tailwind gray borders.

### Text
- **Ink** (`{colors.ink}`) for body. **Muted** (`{colors.muted}`) for captions, meta lines under names, table headers (uppercase, tracked). Muted on cream is 4.9:1. Do not put muted text on navy; use white at 60% instead.

### Semantic
- Success green: checked in, confirmed, all slots filled, verified. Pill: green-100 background, green-800 text.
- Danger red: Drop, Remove, Delete buttons (white fill, red-300 border, red-700 text), error alerts.
- Status pills map: signed_up navy tint, confirmed green, sub_requested gold, declined gray, draft gray, published green, cancelled red, invited gold, active green, inactive gray.

## Typography

- Page title: `{typography.display}` bold in navy, with an optional `{typography.eyebrow}` in rust above it (Open seats, Your Masses, the Mass title) and a one-line `{typography.body}` muted subtitle that says what to do here.
- Card and section titles: `{typography.heading}` bold in navy.
- Volunteer surfaces read at 16px body, 14px for meta lines, never 12px except pills and eyebrows. Buttons are 16px weight 600, labels 14px weight 600.
- Table headers: `{typography.caption}` uppercase, tracked, muted.
- Dates read "Sun, Oct 4 · 10:30 AM" with a middle dot, and they never wrap. Use `whitespace-nowrap` on any date-time string in a table cell.
- No em dashes anywhere. Use a period, a comma, or a middle dot.
- Webfonts load from Google Fonts. Fallback stack is Georgia / system sans, and the layout must still hold if the webfont fails.

## Layout

- 4px base. Card padding 16px. Gaps between cards 16px. Section gap 24px. Page gutter 16px on phone.
- Container max 1152px, centered. Two-column layouts are `lg:grid-cols-3` with the working area spanning two and a sidebar form in the third; below `lg` they stack, sidebar last.
- Header: white, hairline bottom. Mark plus two-line wordmark left (bold serif name over a tracked "Parish Community of Saint Helen" or "Staff"), first name and Sign out right. Pill tabs underneath, 44px tall, active one navy. On phone the volunteer wordmark shortens to a "Saint Helen" eyebrow over "Liturgy Scheduler" and the tabs move to a fixed bottom bar with an icon and a word per item, 64px tall. Admin keeps the top tabs, scrolling, at every width.
- Volunteer home opens with a navy band (greeting, one line of status, the Sign up to serve button), then cards: next Masses two-thirds wide, open-seat count and ministries stacked beside it.
- Sign-up is a grid, weekends down and Mass times across; see Components.
- Sign-in is split: a photo of the parish at Mass under a navy gradient with the mark, eyebrow, title and one sentence, beside the form card. Staff sign-in swaps the photo for a plain navy band so nobody mistakes one for the other. On phone the panel sits on top.

## Elevation and depth

- Cards: faint hairline at 60% plus `{elevation.card}`, `{rounded.lg}`. Buttons carry `{elevation.button}` and rise to `{elevation.button-hover}` with a 1px lift, as on the site. Those are the only shadows in the volunteer and admin areas.
- Kiosk panels: navy ground with white at 5% for ministry groups and white tiles for people. No shadows on the kiosk; contrast does the work.
- Modals: black scrim at 50%, white body, `{rounded.xl}`, `{elevation.modal}`.

## Components

### Buttons
Min height 44px, `{rounded.sm}`, weight 600, 16px, soft shadow, 1px lift on hover. Four kinds: primary (navy, white text), accent (rust, white text, for sign-up actions only), ghost (white, 2px navy border, navy text, the site's secondary button), danger (white, 2px red border, red text). `.btn-lg` is 56px and 18px for the one main action on a volunteer screen. Inside admin table rows use `.btn-quiet` (flat, hairline, 12px) or override padding and size. Disabled at 50% opacity. Kiosk buttons are a separate species: min height 68px, 18px text, `{rounded.lg}`.

### Inputs
White, hairline border, `{rounded.sm}`, 48px min height, 16px text so iOS does not zoom, navy border and ring at 25% on focus. Labels above, 14px weight 600. Checkboxes are 20px with `accent-navy` and sit in a 44px row.

### Cards
White, `{rounded.lg}`, `{elevation.card}`. Padding 20px. A card with a header gets a sand/50 header strip with a hairline under it. A Mass card leads with a sand date tile (month small caps over a large serif day). Never nest a card in a card; use a bordered row (`border border-line/70`) inside a card instead.

### Ministry pill
`{rounded.full}`, 12px weight 500, white text on the ministry's own color, short name only. The ministry color is data, not theme, and it is the only place arbitrary hues appear.

### Status pill
Same shape, tinted background with dark text, lowercase, underscores replaced with spaces.

### Tables
Full width, 14px, header caption style, hairline row dividers at 70% opacity. On phone the table stays a table inside an `overflow-x-auto` card rather than collapsing into cards, because staff need to scan columns.

### Sign-up grid
One table: weekends as rows (serif bold "Oct 3–4"), Mass times as columns ("Sat 5p"), weekday Masses as extra rows. Cells are 56px tall on phone (48px wide at 390), 64px on tablet and up. States: open is white with a 2px rust outline and "N open"; picked is rust fill with a check and the seat; serving is green-700 fill reading "You"; full or away is sand. Picks collect in a sticky bar above the bottom tab bar with Clear and a `.btn-lg` Sign up. A Mass with several seat kinds opens a bottom sheet with 56px option rows.

### Alerts
`{rounded.sm}`, 16px, tinted border and background: info navy/5, success green-50, warning gold/10, error red-50.

### Kiosk board
Navy ground, white header text, clock in `{typography.kiosk-clock}`. Mass tabs are rounded-xl chips, the active one white on navy. Ministry groups are white/5 panels. A person tile is white with navy text and "Tap to check in" on the right; once checked in it turns solid green with a check mark and is disabled. Open slots are dashed gold outlines reading "Open. Tap to fill in." Toasts are white pills at the bottom center with an Undo link in rust.

## Motion

- Buttons and tiles: 150ms ease on background. Kiosk tiles scale to 0.99 on press.
- Nothing else animates. No page transitions, no skeleton shimmer, no bouncing. The kiosk refreshes data every 20 seconds silently.
- Respect `prefers-reduced-motion` if any motion is ever added.

## Responsive behavior

- Phone (390px) is the primary volunteer width and the audience runs 18 to 99. Everything must work one-handed and with reading glasses: 44px minimum targets, 48px inputs, 56px for the main action, 16px body text, no horizontal page scroll. Tablet (820px) gets the desktop layout with wider grid cells.
- Admin is designed at 1280px and must remain usable at 390px by scrolling tables horizontally, never by hiding columns silently.
- Kiosk is designed at 1024x600 (7 inch) through 1920x1080. Three ministry columns at xl, two at md, one below. No hover states matter there.
- Volunteer nav moves to the bottom tab bar below md; admin nav stays a scrolling row.

## Voice and copy

Direct, short, plain. Written the way the parish office talks, not the way software talks. Say "Mass" not "event", "slot" not "opportunity", "sub" not "substitute volunteer". Never "excited", "wonderful opportunity", "we look forward to". The parish is "Saint Helen", never "St. Helen's". No em dashes.

Rules, in order of how often they get broken:

1. **No helper text that restates the control.** A field labeled "Mobile number or email" with a button "Send code" needs no sentence under it. Cut "We will send a six digit code", "No password needed", "You can always sign in with a code instead". If the reader could guess it, delete it.
2. **No reassurance.** "Thank you!", "Don't worry", "Thanks for the heads up", "on its way", "we've got you". State what happened: "Mary Smith checked in." "New code sent."
3. **No page subtitles that describe the page to itself.** "The next three weekends at a glance", "How we reach you and how you sign in", "Here is where things stand" say nothing the title and content do not. A subtitle earns its place only when it tells the reader something they cannot see: "Volunteers see published Masses only."
4. **No exclamation points.** Anywhere.
5. **No "we" narration.** "We sent a code to" becomes "Sent to". "We don't have an account for" becomes "No account matches". Use "we" only when the parish office is doing something for the person: "Contact the parish office."
6. **Errors say what is wrong, in one sentence, and stop.** "That code is not right." Not "That code is not right. Check it and try again." The retry is implied by the form still being there.
7. **Placeholders are not instructions.** Labels carry the name, placeholders stay empty unless a format example prevents a real mistake (a CSV sample). Never put a fake example name or address in a field.
8. **Buttons are one or two words that name the outcome.** "Send code", "Sign in", "Finish", "Add", "Assign", "Drop". Not "Add person", "Finish setup", "Assign someone...".
9. **No trailing ellipses** on pending states or loading text. "Loading", "Sending", "Checking" without dots is fine; the button is disabled, which says the rest.
10. **Empty states are one sentence with the next action if there is one.** "Nothing scheduled. Sign up." "No Masses in this range."
11. **Contractions are fine in texts, not in the interface.** Texts and emails can say "you're" and "can't"; buttons, labels, and alerts say "cannot" and "you are" so they read the same on every phone.

- Empty state: "Nothing scheduled. Sign up."
- Error: "That code is not right."
- Confirmation: "Mary Smith checked in."

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
