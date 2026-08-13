---
name: FareWise
description: Honest flight search — a record of what each fare actually costs you.
colors:
  bg: "#eef0ee"
  card: "#ffffff"
  sunk: "#e4e7e5"
  ink: "#12171a"
  ink-2: "#586267"
  line: "#d5d9d7"
  line-2: "#c3c9c6"
  navy: "#1e3f77"
  navy-2: "#16305c"
  navy-tint: "#e8eef8"
  navy-on: "#a8c0e6"
  alert: "#9c2028"
  alert-bg: "#fbeeee"
  ok: "#1c6b52"
  ok-tint: "#e2efe9"
typography:
  h1:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.14
    letterSpacing: "-0.03em"
  price:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "31px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.03em"
  finding:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.42
    letterSpacing: "-0.015em"
  title:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  secondary:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.14em"
rounded:
  control: "10px"
  card: "16px"
  action: "12px"
spacing:
  xs: "6px"
  sm: "11px"
  md: "16px"
  lg: "20px"
  xl: "26px"
components:
  button-primary:
    backgroundColor: "{colors.navy}"
    textColor: "#ffffff"
    rounded: "14px"
    minHeight: "56px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.navy-2}"
    textColor: "#ffffff"
  form-row:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    minHeight: "66px"
    padding: "13px 16px"
    borderBottom: "1px solid {colors.line}"
  fare-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    border: "1px solid {colors.line-2}"
  record-row:
    textColor: "{colors.ink}"
    labelColor: "{colors.ink-2}"
    padding: "11px 16px"
    borderBottom: "1px solid {colors.line}"
  finding-block:
    backgroundColor: "{colors.navy}"
    textColor: "#ffffff"
    secondaryTextColor: "{colors.navy-on}"
    rounded: "{rounded.card}"
    padding: "20px"
  popover:
    backgroundColor: "{colors.card}"
    border: "1px solid {colors.line-2}"
    rounded: "{rounded.card}"
    shadow: "0 12px 30px rgba(18, 23, 26, 0.14)"
---

# Design System: FareWise

## 1. Overview

**Creative North Star: "The Record"**

FareWise looks like a document you'd be handed by someone who has no stake in what you choose. The page is cool paper grey. Facts sit on white cards, each one a labelled row with its value right-aligned, so a column of fares can be read down rather than decoded one card at a time. The finding — what we actually think the cheap option costs you — is printed in deep record navy, the one filled block on the screen.

It is light because people compare fares in daylight, on a phone, standing up. It is high-contrast because the honest read is the product, and a product you can't read at arm's length isn't honest.

The system rejects the **generic SaaS dashboard** (no identical card grids, no gradient hero-metric), **booking-site urgency** (no scarcity banners, no countdowns, no "2 seats left"), and **travel-blogger gloss** (no full-bleed beaches, no wanderlust copy). It is a record, not a control surface and not a brochure.

**Key characteristics:**
- Cool paper-grey canvas, white cards, one navy, one alert red
- Two faces only: IBM Plex Sans for anything a person reads, IBM Plex Mono for anything whose digits must line up
- Every fact is a labelled row; every value is right-aligned
- The verdict is a filled navy block — the only filled block on the screen
- Phone-first single column, 560px maximum. There is no desktop layout, only a wider phone.

## 2. Colors

### Surfaces
- **Paper Grey** (`#eef0ee`): the page. Cool, no yellow in it — yellow reads as aged paper, and this is a document printed today.
- **Card White** (`#ffffff`): every raised surface — the search card, each fare card, both popovers.
- **Sunk** (`#e4e7e5`): recessed strips. The one-line judgement under a fare, the "note" callout, the third-party tag.

### Ink
- **Ink** (`#12171a`): primary text. 18.1:1 on white.
- **Ink 2** (`#586267`): labels and secondary text. 6.3:1 on white, 5.5:1 on the page, 5.0:1 on sunk — it clears AA on all three surfaces it is used on.
- **Line** (`#d5d9d7`) / **Line 2** (`#c3c9c6`): hairlines inside cards, and the stronger edge on card and control borders. Never text.

### The record ink
- **Record Navy** (`#1e3f77`): the finding block, the primary action, the seller link, the disclosure buttons, the focus ring. 10.3:1 with white on it, 10.3:1 as text on white.
- **Navy 2** (`#16305c`): hover and pressed.
- **Navy Tint** (`#e8eef8`): the "cheapest" tag, the highlighted autocomplete row, the focused form row.
- **Navy On** (`#a8c0e6`): secondary text *on* the navy block — the kicker. 5.6:1 on navy.

### The signal
- **Alert** (`#9c2028`): the catch — separate tickets, a tight connection, a suspiciously low fare, a next-day arrival, a real failure. 7.9:1 on white, 7.0:1 on its own tint.
- **Alert BG** (`#fbeeee`): the warning callout and the error block.
- **OK** (`#1c6b52`): we checked and found nothing to warn about. 6.4:1 on white, 5.4:1 on its own tint.
- **OK Tint** (`#e2efe9`): the "no catch found" tag and the "direct" seller tag.

### Named rules

**The One Navy Rule.** Navy marks the finding and the primary action, nothing else. A screen with three navy blocks has two too many. Its scarcity is what makes the honest read read as the honest read.

**The Signal-Never-Alone Rule.** Green and red always ship with an icon *and* a word. Colour is the fast cue, never the only cue. A colour-blind user gets the same warning from the text.

**The No-Claim Rule.** Green says only what we checked, never what we can't verify. The good tag reads "No catch found", not "One ticket" — the data source returns no separate-ticket or protection signal, so asserting protection would be a claim we never earned.

## 3. Typography

**Body:** IBM Plex Sans (system-ui, sans-serif fallback) — 400 / 500 / 600 / 700
**Mono:** IBM Plex Mono (ui-monospace, monospace fallback) — 500 / 600

There is no display face. A product UI doesn't need one, and a decorative headline face on a page about honest pricing is exactly the wrong signal. The contrast axis is sans-versus-mono: sentences in one face, data in the other.

### Hierarchy
- **H1** (Sans 700, 30px, ls -0.03em): "Where to?" — the search screen only, and it hides once a search has run.
- **Price** (Mono 600, 31px, tabular): the fare on each card.
- **Finding** (Sans 400, 19px, lh 1.42): the lines of the honest read, set on the navy block.
- **Title** (Sans 600, 20px): the airline on a fare card.
- **Body** (Sans 400, 17px, lh 1.5): explanations, warnings, empty states. Nothing that must be read is smaller than 15px.
- **Secondary** (Sans 400, 15px): supporting lines, the promise, the price-insight line, the footer.
- **Label** (Sans 600, 12.5px, ls 0.14em, UPPERCASE): the one label tier — form-row keys, section kickers, the warning word, the outbound/return heads. Nothing smaller than this renders text.

### Named rules

**The Mono-for-Digits Rule.** Times, prices, and airport codes are set in IBM Plex Mono with tabular figures, so a column of them lines up and the digits don't wobble as they change. Every human sentence is sans. The face tells the user whether they are reading a measurement or a judgement.

## 4. Elevation

Nearly flat. Depth comes from tone and hairlines, not shadow: page grey → white card → sunk strip. Only genuinely floating layers cast anything.

- **Card:** no shadow. A 1px `line-2` border and the tonal step off the page do the work.
- **Popover** (`0 12px 30px rgba(18, 23, 26, 0.14)`): the autocomplete list and the travelers panel — the only two things that float above the page.
- **Sticky header:** the results search bar sits on the page colour with a `line-2` bottom edge, no shadow.

**The Flat-Unless-Floating Rule.** A shadow means "this is above the page and will go away." A card that never moves doesn't get one.

## 5. Components

### The record row (signature)
One fact per row: a label in `ink-2` on the left, the value right-aligned in 600 weight, a hairline between. This is the component the whole system is named for. Route and times sit in mono so two cards can be compared down the column; everything else is sans. Total cost is the last row, and when the data source doesn't itemise fees it says `fare only · fees not listed` rather than implying a total we don't have.

### The finding block (signature)
The honest read: a filled navy card, an uppercase kicker in `navy-on`, then the lines as plain 19px paragraphs — no bullets, because inside a filled block a bullet is decoration. It ends on the last line of the read. Nothing follows it explaining how FareWise makes money; a page that volunteers that reads as a page with something to defend.

### Buttons
- **Primary:** navy fill, white text, 14px radius, 56px tall, full width. One per screen.
- **Action** (seller link, "Done"): navy fill, 12px radius, 50px tall, full width of its panel.
- **Chip** (trip type): white with a `line-2` border; the pressed one inverts to `ink` fill with white text. State is carried by `aria-pressed`, and the CSS keys off it — there is no separate active class to fall out of sync.
- **Disclosure:** navy text, no fill. The card's own toggle is a full-bleed 52px row with a hairline above it; the nested "How to book" is quieter — inline, no edge — because it opens a panel inside a panel. Each chevron rotates off its own button's `aria-expanded`.

### Form
One card, one row per fact, 66px per row, hairline between, label 48px wide on the left. Focus tints the whole row `navy-tint` so the active field is obvious without a heavy outline. Out/Back split the row; Who and cabin share the last one.

### Warnings (signature)
Always visible, never behind a toggle, and generated in code rather than by the model. A tinted block with an icon plus an uppercase word (`Warning` / `Note`), then a full, blunt, complete sentence. This is the one place brevity loses to clarity.

### States
- **Loading:** a stage list over three card-shaped skeletons. A live search can run half a minute, and at that length the user's problem is doubt, not boredom — so the route streams each phase as it truly begins (searching flights → checking return flights → reading the fine print) and each row turns from waiting to working to done. No spinner, and **no progress bar or percentage**: we don't know how long the data source will take, so any bar would be invented motion. The skeletons hold the space so nothing jumps when the real cards land.
- **Error** (a real failure): the alert-edged block. We'd rather show nothing than prices we can't verify.
- **Empty** (no flights for these dates): a calm white card. This is an answer, not a failure, and it must never be dressed as one.

### Navigation
No persistent nav. The flow is search → results, with a sticky context bar carrying the route, what we read, and a way back.

## 6. Retired — do not reintroduce

The **"Night Departure Board"** system is retired, not paused: night navy and warm charcoal surfaces, signal orange as the accent, the split-flap hero board, the perforated boarding-pass ticket card, the amber atmosphere glow, and the scanline overlay. None of it returns. If a future request asks for "more personality," it gets it from typography, rhythm, and the finding block — not from bringing the board back.

## 7. Do's and Don'ts

### Do
- **Do** keep navy on the finding and the primary action only (The One Navy Rule).
- **Do** pair every green or red with an icon and a word (The Signal-Never-Alone Rule).
- **Do** set times, prices, and airport codes in mono with tabular figures (The Mono-for-Digits Rule).
- **Do** write risk warnings as full, blunt, complete sentences, and keep them visible when the card is collapsed.
- **Do** say what we checked, never what we haven't verified (The No-Claim Rule).
- **Do** keep every interactive element ≥44px, form rows at 66px, and the primary action at 56px.
- **Do** state total cost — or state plainly that fees aren't listed.

### Don't
- **Don't** reintroduce orange, cream, neon accents, faux paper texture, perforations, hatch fills, scanlines, or radial atmosphere glows.
- **Don't** build a generic SaaS dashboard: no identical card grids, no gradient hero-metric block.
- **Don't** add booking-site urgency: no scarcity banners, no countdowns, no manufactured pressure. Money never reorders results.
- **Don't** use travel-blogger gloss: no full-bleed beach photography, no wanderlust copy.
- **Don't** introduce a second accent hue. Navy is the voice; red and green exist only as the signal.
- **Don't** render text below 12.5px, and don't use the label tier for anything but labels.
- **Don't** hide a warning behind a disclosure, ever.
- **Don't** put an explaining sentence under a heading. If the control below it already shows what the thing does, the sentence is filler and reads as machine-written padding. "Where to?" stands alone above the form.
- **Don't** tell the user how FareWise gets paid, in any wording. Ranking honestly is the behaviour; announcing it invites the question of who pays and what it bought. Volunteering the disclaimer reads as defensive, not transparent.
- **Don't** show a progress bar, a percentage, or any indicator that implies we know how much of the wait is left. Report phases that have actually happened; never predict.
- **Don't** use an em dash or an en dash in anything a user reads — copy, labels, warnings, ranges, or generated text. Use a full stop, a comma, or the word "to" for a range. The dash is the loudest tell that a sentence was machine-written.

## 8. Dark theme

Not built. When it is, it is one `@media (prefers-color-scheme: dark)` block in `app/globals.css` that redefines these same token names — and nothing downstream changes. Contrast must be re-verified against the dark values; the light ratios do not transfer.
