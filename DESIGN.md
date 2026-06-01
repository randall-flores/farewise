---
name: FareWise
description: Honest flight search — the night departure board that tells you the catch.
colors:
  page: "#1a1613"
  page-inset: "#16120f"
  card: "#23201b"
  card-top: "#2a261f"
  amber: "#ef9f27"
  amber-soft: "#f3b455"
  cream: "#f6f1e7"
  cream-secondary: "#f6f1e79e"
  cream-faint: "#f6f1e76b"
  cream-hairline: "#f6f1e71f"
  good: "#79c79a"
  warn: "#ef9f27"
  risk: "#e8694a"
typography:
  display:
    fontFamily: "Instrument Serif, Georgia, serif"
    fontSize: "clamp(3rem, 9vw, 5rem)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Instrument Serif, Georgia, serif"
    fontSize: "clamp(17px, 2.4vw, 19px)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "clamp(19px, 2.6vw, 22px)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "1.08rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.16em"
  data:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "clamp(30px, 5vw, 40px)"
    fontWeight: 500
    lineHeight: 0.95
    letterSpacing: "-0.01em"
rounded:
  chip: "7px"
  input: "10px"
  card: "14px"
spacing:
  xs: "7px"
  sm: "12px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.page}"
    typography: "{typography.label}"
    rounded: "{rounded.input}"
    padding: "13px 24px"
  button-primary-hover:
    backgroundColor: "{colors.amber-soft}"
    textColor: "{colors.page}"
  input-field:
    backgroundColor: "{colors.page-inset}"
    textColor: "{colors.cream}"
    typography: "{typography.data}"
    rounded: "{rounded.input}"
    padding: "12px 14px"
  suggestion:
    backgroundColor: "{colors.card-top}"
    textColor: "{colors.cream}"
    rounded: "{rounded.chip}"
    padding: "10px 12px"
  flight-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.cream}"
    rounded: "{rounded.card}"
    padding: "26px 28px"
  book-link:
    backgroundColor: "{colors.page}"
    textColor: "{colors.amber}"
    typography: "{typography.label}"
    rounded: "{rounded.chip}"
    padding: "10px 16px"
---

# Design System: FareWise

## 1. Overview

**Creative North Star: "The Night Departure Board"**

FareWise looks like a warm charcoal airport terminal after midnight. The page is near-black with a faint amber glow bleeding down from the top, like board-light over an empty concourse. The hero is a real split-flap board spelling the route. Amber is the only accent — it is the board, the caution, the call to act — and it earns its rarity. Cream text sits calm and legible on the dark. Mono labels tick along like gate listings. Nothing is loud; the authority comes from restraint and from telling the truth on screen.

The system rejects the **generic SaaS dashboard** outright: no card-grid control panels, no gradient hero-metric, no blue-and-white tool chrome. It rejects **booking-site urgency** (no red scarcity banners, no countdowns) and **travel-blogger gloss** (no full-bleed beaches, no wanderlust mood photography). FareWise is editorial and mechanical, not a control surface and not a brochure. Components feel like board hardware: solid, tactile, mono-labeled, every element stating a fact.

**Key Characteristics:**
- Dark warm-charcoal canvas, single amber accent, cream type
- Three-font system: serif display, sans body, mono labels/data
- Split-flap board as signature hero element
- Honesty layer rendered as color-coded, icon-paired warnings — never color alone
- Calm, authoritative, mechanical; restraint over decoration

## 2. Colors

A warm dark palette: charcoal surfaces stepped by tone, one amber accent, cream text, and a three-color risk signal.

### Primary
- **Board Amber** (`#ef9f27`): the only accent. Primary actions (submit, book), the split-flap arrow, caution warnings, kickers, active autocomplete rows. It is the board light. Used sparingly so it always means "look here."
- **Amber Glow** (`#f3b455`): hover state for amber surfaces and the brighter accent text on active rows.

### Neutral
- **Concourse Charcoal** (`#1a1613`): the page. Warm near-black; the terminal at night.
- **Inset Black** (`#16120f`): deeper recess for inputs and callouts, so fields read as cut into the surface.
- **Card Charcoal** (`#23201b`) / **Card Top** (`#2a261f`): card surfaces, used as a top-to-bottom gradient so cards catch a faint board-light highlight.
- **Cream** (`#f6f1e7`): primary text. Calm, warm white.
- **Cream Secondary** (`#f6f1e7` at 62%): supporting text, routes, meta.
- **Cream Faint** (`#f6f1e7` at 42%): faint labels and dimmed prices. **Audit risk: verify this clears 4.5:1 on charcoal before using for any text that must be read.**
- **Cream Hairline** (`#f6f1e7` at 12% / 8%): dividers and borders only, never text.

### Tertiary — The Risk Signal
- **Reassurance Green** (`#79c79a`): the "good" verdict — one ticket, protected, realistic connection. Status dots, good flags.
- **Caution Amber** (`#ef9f27`): the "watch this" signal — same hue as the accent, reused for medium-risk flags.
- **High-Risk Red** (`#e8694a`): separate tickets, tight connections, suspiciously low fares. The loud warning.

### Named Rules
**The One Board-Light Rule.** Amber is the only accent and appears on a small fraction of any screen. Three amber buttons on one view means two too many. Its scarcity is what makes it read as "act here."

**The Signal-Never-Alone Rule.** Green / amber / red always ship with a text label and an icon. Color is the fast cue, never the only cue. A color-blind user must get the same warning from the words.

## 3. Typography

**Display Font:** Instrument Serif (with Georgia, serif fallback) — normal + italic, weight 400
**Body Font:** Figtree (with system-ui, sans-serif fallback)
**Label / Data Font:** IBM Plex Mono (with ui-monospace, monospace fallback)

**Character:** A serif that's elegant but plain (no fuss), a clean humanist sans for reading, and a mono that does the work of a real departure board — gate codes, prices, times, uppercase labels. The contrast axis is serif-vs-mono, never two similar sans.

### Hierarchy
- **Display** (Instrument Serif 400, `clamp(3rem, 9vw, 5rem)`, lh 1.1): the FareWise wordmark and split-flap glyphs. Hero only.
- **Headline** (Instrument Serif 400, `clamp(17px, 2.4vw, 19px)`, lh 1.1): the verdict summary — the honest read, set in serif so it feels spoken, not labeled.
- **Title** (Figtree 600, `clamp(19px, 2.6vw, 22px)`, lh 1.2): airline / card titles.
- **Body** (Figtree 400, ~1.08rem, lh 1.55): explanations and subtitle. Cap measure at ~54ch (already set on subtitle).
- **Label** (IBM Plex Mono 600, 11px, ls 0.16em, UPPERCASE): field labels, kickers, section rules, button text, the "book via" link.
- **Data** (IBM Plex Mono 500, `clamp(30px, 5vw, 40px)`, lh 0.95): prices and the big numbers. Mono so digits align like a board.

### Named Rules
**The Mono-for-Facts Rule.** Anything that is data — a price, a time, a flight number, a gate-style label — is set in IBM Plex Mono. Anything that is a human sentence — the verdict, the explanation — is serif or sans. The font tells the user whether they're reading a fact or a judgment.

## 4. Elevation

A hybrid: flat surfaces lifted by soft, warm shadows and one atmospheric glow. Depth is conveyed by tonal layering (page → inset → card gradient) first, shadow second. There is no glassmorphism and no hard drop-shadow; shadows are diffuse and dark, like board hardware sitting slightly proud of the wall.

### Shadow Vocabulary
- **Card lift** (`box-shadow: 0 18px 40px rgba(0,0,0,0.28)`): the form and verdict card. A large, soft, downward shadow.
- **Card rest** (`box-shadow: 0 6px 16px rgba(0,0,0,0.35)` + inset top highlight): split-flap tiles; reads as physical hardware.
- **Dropdown** (`box-shadow: 0 16px 36px rgba(0,0,0,0.4)`): autocomplete suggestions, floating above the form.
- **Atmosphere glow** (fixed radial amber, ~10% opacity, top of viewport): board-light bleed. Plus a near-invisible scanline overlay (soft-light, 35%) for board texture.

### Named Rules
**The Hardware-Not-Glass Rule.** Surfaces are opaque and warm. Shadows are dark and diffuse, never a bright glow or a frosted blur. If a panel looks like frosted glass, it's wrong — these are metal flaps and lit panels, not glass.

## 5. Components

Components feel **mechanical and honest**: solid board hardware, mono-labeled, nothing decorative. Every element states a fact.

### Buttons
- **Shape:** 10px radius (`{rounded.input}`).
- **Primary:** solid Board Amber background, charcoal text, mono uppercase label (13px, ls 0.06em), padding 13px 24px. Left-aligned in the form, not full-width.
- **Hover / Focus:** background shifts to Amber Glow (`#f3b455`); focus shows a 2px amber outline, offset 1px. Disabled drops to 55% opacity.
- **Toggle (ghost):** "Show the read" expander — mono uppercase amber text, no fill, 44px min touch target, chevron rotates 180° on open.

### Cards / Containers
- **Corner Style:** 14px radius (`{rounded.card}`).
- **Background:** Card Charcoal, or a `card-top → card` vertical gradient on the form and verdict.
- **Shadow Strategy:** Card lift (see Elevation). Hover nudges the border to cream-12 and lifts 1px.
- **Border:** 1px cream-08 hairline.
- **Internal Padding:** `clamp(20px, 3.4vw, 28px)`.

### Inputs / Fields
- **Style:** Inset Black background, 1px cream-12 stroke, 10px radius, mono text. Labels above in mono uppercase.
- **Focus:** 2px amber outline, border goes transparent.
- **Dark-native dates:** the `mm/dd/yyyy` hint renders cream-40 muted; a real value brightens to cream; the calendar icon is inverted to stay visible. (Hard-won — empty date fields used to look blank.)
- **Autocomplete:** floating dropdown (Card Top, dropdown shadow), city headers bold with a hairline under, airports indented under their city with an amber 35% guide rule, active row amber-tinted.

### The Honesty Layer (signature component)
The reason FareWise exists. Three pieces, all always-visible (never hidden behind a toggle):
- **Verdict card:** serif summary, one tight line per flight, amber verdict tag (mono uppercase) with a rotated-square bullet.
- **Flag** (per card): a colored circular icon + sentence. `flagGood` (green check), `flagCaution` (amber), `flagRisk` (red) — color paired with icon and full-sentence text.
- **Warnings** (per card): stacked callout blocks. `warn_high` (red tint + border), `warn_warn` (amber tint), `warn_info` (cream tint). Each leads with a mono uppercase label, then a plain complete sentence. Risk warnings are never shorthand.

### Navigation
No persistent nav in Phase 1; the page is a single search→results flow. The split-flap board doubles as the wayfinding anchor.

## 6. Do's and Don'ts

### Do:
- **Do** keep amber on ≤10% of any screen (The One Board-Light Rule). Let its rarity carry the call to action.
- **Do** pair every green/amber/red signal with an icon and a text label (The Signal-Never-Alone Rule), so the warning survives color blindness and the WCAG 2.2 AA bar.
- **Do** set every price, time, and flight number in IBM Plex Mono; set every human judgment in serif or sans (The Mono-for-Facts Rule).
- **Do** write risk warnings as full, blunt, complete sentences. Clarity beats brevity exactly where the user must understand the danger.
- **Do** surface total cost (bag + seat → ~total) in the card, never just the headline fare.
- **Do** verify cream-40 (42% opacity) clears 4.5:1 before using it for any text that must be read; bump toward cream-60 or cream if close.

### Don't:
- **Don't** build a **generic SaaS dashboard**: no identical card grids, no gradient hero-metric block, no blue-and-white tool chrome.
- **Don't** add **booking-site urgency**: no red scarcity banners, no "2 seats left," no countdowns. Money never reorders results and nothing manufactures pressure.
- **Don't** use **travel-blogger gloss**: no full-bleed beach photography, no wanderlust mood copy.
- **Don't** use glassmorphism or frosted blur (The Hardware-Not-Glass Rule). Surfaces are opaque warm metal, not glass.
- **Don't** introduce a second accent hue. Amber is the only voice; green/amber/red exist solely as the risk signal.
- **Don't** rely on the `border-left: 3px amber` stripe on the verdict card — a colored side-stripe over 1px is a banned pattern. Carry the accent with the existing amber verdict tag and a full hairline instead.
