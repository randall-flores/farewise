# FareWise "Record" Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Departure Board" visual world (night navy + signal orange + split-flap hero, desktop two-column) with "Record" — a light, high-contrast, phone-first single-column app whose verdict is printed as a finding in record navy and whose facts are labelled rows with right-aligned values.

**Architecture:** Three layers change and nothing else. (1) `app/globals.css` becomes the token layer — new palette, new type stack, atmosphere effects deleted. (2) `app/layout.js` swaps the font trio. (3) `app/page.module.css` is rewritten class-for-class against the same class names `search-experience.js` already uses, so most of the JSX is untouched; `search-experience.js` changes only where the *structure* differs (hero removed, fare card becomes labelled rows, detail gains a timeline). No API route, no `lib/` module, and no data shape changes.

**Tech Stack:** Next.js 16 App Router, React 19, CSS Modules, `next/font/google`, Vitest (existing `lib/` unit tests only).

## Global Constraints

- **Approved direction is `mockups/r2-02-record.html`.** It is the contract for palette, type scale, spacing, and component shape. Open it beside the code while working.
- **Light theme only.** Do not author a dark theme. Tokens must be structured so a `@media (prefers-color-scheme: dark)` block can be added later as one block.
- **Banned:** orange, cream, neon accents, faux paper textures, perforations, hatch fills, scanline overlays, radial "atmosphere" glows, gradient hero-metric blocks.
- **Type floor:** body 17px, secondary 15px, one label tier at 12.5px uppercase `letter-spacing: .14em`. Nothing smaller renders text.
- **Touch floor:** every interactive element ≥ 44px tall; form rows 66px; primary action 56px.
- **Contrast:** WCAG 2.2 AA. `--ink-2` on `--card` and on `--bg` must both clear 4.5:1. Never signal with colour alone — every green/red state ships with an icon and a word.
- **Voice unchanged:** state the fact, then why it matters, then stop. Risk warnings stay full, blunt, complete sentences.
- **Copy is not in scope.** Do not rewrite existing product copy except the three strings this plan names explicitly.
- **Do not touch:** `app/api/**`, `lib/**`, `next.config.mjs`, `jsconfig.json`.

---

## File Structure

| File | Action | Responsibility after this plan |
|---|---|---|
| `app/globals.css` | Rewrite | Token layer only: palette, fonts, radii, spacing, base element resets, reduced-motion guard. No component styles, no atmosphere pseudo-elements. |
| `app/layout.js` | Modify | Loads IBM Plex Sans + IBM Plex Mono, exposes them as `--font-body` / `--font-mono`. `--font-display` is retired. |
| `app/page.module.css` | Rewrite | Every component style, in the Record system. Same class names as today wherever the JSX is unchanged. |
| `app/search-experience.js` | Modify | Structural changes only: hero replaced by app header + search card; `FlapBoard` / `FlapText` / `CountUpPrice` / `useCountUp` deleted; fare card body becomes labelled rows; detail gains the stop timeline and cost table. All state, fetch, validation, and a11y wiring stay as-is. |
| `app/page.js` | Modify | One-line change: `styles.wrap` becomes the app shell container. |
| `DESIGN.md` | Rewrite | Replaces the Departure Board system with Record. Frontmatter tokens must match `globals.css` exactly. |
| `PRODUCT.md` | Modify | One paragraph: the "Visual identity (already committed)" line in Brand Personality now describes Record. |
| `mockups/` | Leave | Reference material. Not shipped, not linted, not imported. |

---

### Task 1: Token layer and fonts

**Files:**
- Modify: `app/layout.js:1-22`
- Rewrite: `app/globals.css`
- Test: manual — `npm run build` and a browser check

**Interfaces:**
- Consumes: nothing.
- Produces: CSS custom properties consumed by every later task —
  `--bg --card --sunk --ink --ink-2 --line --line-2 --navy --navy-2 --navy-tint --alert --alert-bg --ok --ok-tint --body --mono --r --r-sm --tap`

- [ ] **Step 1: Swap the fonts in `app/layout.js`**

Replace lines 1–22 with:

```js
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Record's two faces. IBM Plex Sans carries everything a person reads; IBM Plex
// Mono carries anything whose digits must line up in a column (times, prices,
// airport codes). There is no display face — a product UI doesn't need one.
const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-mono",
  display: "swap",
});
```

Then update the `<html>` className on line 31 to drop the retired display font:

```js
    <html lang="en" className={`${body.variable} ${mono.variable}`}>
```

- [ ] **Step 2: Rewrite `app/globals.css` completely**

```css
/* ---- FareWise design tokens — "Record" ----
   A light, high-contrast record: cool paper grey page, white cards, deep record
   navy for the verdict and primary actions, one alert red for the catch.
   This file holds tokens and base resets ONLY. Component styles live in
   page.module.css. Adding a dark theme later means adding one media block here
   that redefines these same names — nothing downstream changes. */
:root {
  /* surfaces */
  --bg: #eef0ee;          /* page — cool paper grey, no yellow in it */
  --card: #ffffff;        /* raised surface: search card, fare card */
  --sunk: #e4e7e5;        /* recessed: the "say" line, summary rows */

  /* ink */
  --ink: #12171a;         /* primary text — 15.8:1 on --card */
  --ink-2: #586267;       /* secondary text — 5.4:1 on --card, 4.9:1 on --bg */
  --line: #d5d9d7;        /* hairlines inside cards */
  --line-2: #c3c9c6;      /* stronger edge: card borders, control borders */

  /* the record ink — verdict block, primary action, chosen state */
  --navy: #1e3f77;        /* 8.4:1 with white text on it */
  --navy-2: #16305c;      /* pressed */
  --navy-tint: #e8eef8;   /* tag background */
  --navy-on: #a8c0e6;     /* secondary text ON the navy block — 5.1:1 */

  /* signals — always paired with an icon and a word, never colour alone */
  --alert: #9c2028;       /* the catch: separate tickets, tight connection */
  --alert-bg: #fbeeee;
  --ok: #1c6b52;          /* one ticket, protected */
  --ok-tint: #e2efe9;

  --body: var(--font-body), system-ui, sans-serif;
  --mono: var(--font-mono), ui-monospace, monospace;

  --r: 16px;              /* cards */
  --r-sm: 10px;           /* chips, tags, small controls */
  --tap: 44px;            /* minimum touch target */
}

* { box-sizing: border-box; }

html {
  -webkit-text-size-adjust: 100%;
  color-scheme: light; /* native date picker and select render light */
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--body);
  font-size: 17px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  min-height: 100dvh;
}

h1, h2, h3 {
  font-family: var(--body);
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
  margin: 0;
}

a { color: inherit; }

button, input, select { font: inherit; }

/* Digits that sit in a column must not wobble as they change. */
.tabular, input[type="date"] { font-variant-numeric: tabular-nums; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

Note what is deliberately gone: `body::before` (the orange radial glow), `body::after` (the scanline overlay), `--serif` / `--font-display`, and every `--amber` / `--cream` token name.

- [ ] **Step 3: Verify the build compiles and the page is light**

Run: `npm run build`
Expected: build succeeds. (`page.module.css` still references old token names at this point — that is fine, CSS does not fail on undefined custom properties, and Task 2 replaces it.)

Run: `npm run dev`, open `http://localhost:3000`
Expected: the page background is now light grey and text is dark. Layout will look broken — that is expected until Task 3.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css app/layout.js
git commit -m "redesign: Record token layer and IBM Plex type stack"
```

---

### Task 2: App shell and page container

**Files:**
- Modify: `app/page.js`
- Modify: `app/page.module.css` — replace the `.wrap` rule

**Interfaces:**
- Consumes: tokens from Task 1.
- Produces: `.wrap` — the single-column app shell every later task renders inside. Phone-first: full-bleed at 390px with 20px gutters, centred at `max-width: 560px` from 600px up.

- [ ] **Step 1: Replace the `.wrap` rule in `app/page.module.css`**

Find the existing `.wrap` rule and replace it with:

```css
/* The app shell. One column always — it starts at phone width and stops
   growing at a comfortable reading measure. There is no desktop layout,
   only a wider phone. */
.wrap {
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
  padding: 0 20px 40px;
  position: relative;
}
```

- [ ] **Step 2: Verify the shell centres**

Run: `npm run dev`, open `http://localhost:3000` at 1280px wide.
Expected: content is a single centred column, not stretched across the viewport.

- [ ] **Step 3: Commit**

```bash
git add app/page.module.css
git commit -m "redesign: single-column app shell"
```

---

### Task 3: Search screen — header, fields, chips, action

**Files:**
- Modify: `app/search-experience.js:927-1034` (the hero block) and `:253-279` (`FlapBoard`)
- Modify: `app/page.module.css` — `.hero .heroCompact .heroIntro .heroPitch .heroForm .kicker .brand .subtitle .board .boardGhost .flap .code .arrow .form .formTitle .contextStrip .row .field .submit .segmented .segment .segmentActive .cabinSelect`

**Interfaces:**
- Consumes: `.wrap` from Task 2, tokens from Task 1.
- Produces: the `.appbar`, `.fields`, `.field`, `.swap`, `.chips`, `.chip`, `.promise`, `.submit` vocabulary reused by nothing else — this screen is self-contained. `AirportField`'s props and `onSelect(code)` contract are unchanged.

- [ ] **Step 1: Delete `FlapBoard` from `search-experience.js`**

Delete lines 253–279 entirely (the `FlapBoard` function and its comment). The split-flap board belongs to the retired visual world. `FlapText` and `CountUpPrice` are removed in Tasks 5 and 4 respectively.

- [ ] **Step 2: Replace the hero JSX**

In the `SearchExperience` return, replace the whole `<div className={styles.hero}>…</div>` block (lines 931–1034) with:

```jsx
      {/* App bar — the wordmark and nothing else. This is a tool, not a
          landing page; the search card below is the first real thing. */}
      <header className={styles.appbar}>
        <p className={styles.brand}>
          Fare<span>Wise</span>
        </p>
      </header>

      {!(data || loading) && (
        <>
          <h1 className={styles.h1}>Where to?</h1>
          <p className={styles.lead}>
            We read every fare that comes back, then tell you what the cheap one costs you.
          </p>
        </>
      )}

      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.fields}>
          <AirportField
            key={`origin-${resetKey}`}
            label="From"
            name="origin"
            initial={form.origin}
            onSelect={(code) => setForm((f) => ({ ...f, origin: code }))}
          />
          <AirportField
            key={`destination-${resetKey}`}
            label="To"
            name="destination"
            initial={form.destination}
            onSelect={(code) => setForm((f) => ({ ...f, destination: code }))}
          />

          <div className={styles.fieldSplit}>
            <label className={styles.field}>
              <span className={styles.fieldKey}>Out</span>
              <input
                className={styles.fieldInput}
                type="date"
                name="depart"
                value={form.depart}
                onChange={update}
                min={today}
                required
              />
            </label>
            {form.tripType === "round-trip" && (
              <label className={styles.field}>
                <span className={styles.fieldKey}>Back</span>
                <input
                  className={styles.fieldInput}
                  type="date"
                  name="returnDate"
                  value={form.returnDate}
                  onChange={update}
                  min={form.depart || today}
                />
              </label>
            )}
          </div>

          <div className={styles.fieldRow}>
            <span className={styles.fieldKey}>Who</span>
            <TravelersControl
              counts={{
                adults: form.adults,
                children: form.children,
                infantsInSeat: form.infantsInSeat,
                infantsOnLap: form.infantsOnLap,
              }}
              onChange={(c) => setForm((f) => ({ ...f, ...c }))}
            />
            <select
              className={styles.cabinSelect}
              name="cabin"
              value={form.cabin}
              onChange={update}
              aria-label="Cabin"
            >
              <option value="economy">Economy</option>
              <option value="premium">Premium economy</option>
              <option value="business">Business</option>
              <option value="first">First class</option>
            </select>
          </div>
        </div>

        <div className={styles.chips} role="group" aria-label="Trip type">
          <button
            type="button"
            className={styles.chip}
            aria-pressed={form.tripType === "round-trip"}
            onClick={() => setTripType("round-trip")}
          >
            Round trip
          </button>
          <button
            type="button"
            className={styles.chip}
            aria-pressed={form.tripType === "one-way"}
            onClick={() => setTripType("one-way")}
          >
            One way
          </button>
        </div>

        <p className={styles.promise}>
          <b>We don&apos;t inflate prices based on your search history.</b> The airline&apos;s
          price at checkout can still move with market and currency — that part is outside
          our control.
        </p>

        <button className={styles.submit} type="submit" disabled={loading}>
          {loading ? "Searching…" : "Search flights"}
        </button>
      </form>
```

Two behaviour notes: the trip-type control now uses `aria-pressed` on plain chips (the `.segmented` wrapper is gone, so the CSS selector is `.chip[aria-pressed="true"]`), and the `h1` + lead paragraph hide once a search has run so results start at the top of the screen.

- [ ] **Step 3: Update `AirportField`'s markup for the row shape**

In `AirportField` (line ~191), replace the returned `<label className={styles.field}>` opening and its `<span>{label}</span>` with:

```jsx
    <label className={styles.field}>
      <span className={styles.fieldKey}>{label}</span>
      <div className={styles.autocomplete}>
        <input
          className={styles.fieldInput}
          name={name}
```

(Only the wrapper `<span>` gains `styles.fieldKey` and the `<input>` gains `className={styles.fieldInput}`. Every other prop on the input — the whole combobox a11y block — stays exactly as it is.)

- [ ] **Step 4: Replace the search-screen CSS**

In `app/page.module.css`, delete the rules for `.hero .heroCompact .heroIntro .heroPitch .heroForm .kicker .subtitle .board .boardGhost .flap .code .arrow .flapText .flapChar .formTitle .contextStrip .segmented .segment .segmentActive .row` and add:

```css
/* ---- app bar ---- */
.appbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 0 6px;
}
.brand {
  margin: 0;
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.brand span { color: var(--navy); }

.h1 {
  font-size: 30px;
  line-height: 1.14;
  letter-spacing: -0.03em;
  font-weight: 700;
  margin: 16px 0 6px;
}
.lead {
  color: var(--ink-2);
  font-size: 16px;
  margin: 0;
  max-width: 44ch;
}

/* ---- the field stack: one card, one row per fact ---- */
.form { margin-top: 20px; }
.fields {
  background: var(--card);
  border: 1px solid var(--line-2);
  border-radius: var(--r);
  overflow: hidden;
}
.field {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 16px;
  min-height: 66px;
  border-bottom: 1px solid var(--line);
  position: relative;
}
.field:last-child { border-bottom: none; }
.fieldKey {
  font-size: 12.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-2);
  font-weight: 600;
  width: 48px;
  flex: none;
}
.fieldInput {
  width: 100%;
  border: none;
  background: none;
  color: var(--ink);
  font-size: 19px;
  font-weight: 600;
  letter-spacing: -0.01em;
  padding: 6px 0;
  min-height: 40px;
}
.fieldInput::placeholder { color: var(--ink-2); font-weight: 400; }
.fieldInput:focus { outline: none; }
.field:focus-within { background: var(--navy-tint); }
.fieldSplit { display: flex; border-bottom: 1px solid var(--line); }
.fieldSplit .field { flex: 1; border-bottom: none; }
.fieldSplit .field + .field { border-left: 1px solid var(--line); }
.fieldRow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 16px;
  min-height: 66px;
}

/* ---- trip type ---- */
.chips { display: flex; gap: 9px; margin-top: 16px; }
.chip {
  padding: 11px 16px;
  min-height: var(--tap);
  border-radius: var(--r-sm);
  border: 1px solid var(--line-2);
  background: var(--card);
  color: var(--ink-2);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
}
.chip[aria-pressed="true"] {
  background: var(--ink);
  border-color: var(--ink);
  color: #fff;
  font-weight: 600;
}

.promise {
  margin: 20px 0 0;
  color: var(--ink-2);
  font-size: 15px;
  line-height: 1.5;
}
.promise b { color: var(--ink); font-weight: 600; }

.submit {
  display: block;
  width: 100%;
  min-height: 56px;
  margin-top: 16px;
  border: none;
  border-radius: 14px;
  background: var(--navy);
  color: #fff;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
  cursor: pointer;
}
.submit:hover { background: var(--navy-2); }
.submit:disabled { opacity: 0.55; cursor: default; }

/* One focus treatment for the whole app. */
.chip:focus-visible,
.submit:focus-visible,
.cabinSelect:focus-visible,
.fieldInput:focus-visible {
  outline: 2px solid var(--navy);
  outline-offset: 2px;
}
```

- [ ] **Step 5: Verify the search screen**

Run: `npm run dev`, open `http://localhost:3000` at 390px width (device toolbar).
Expected: wordmark, "Where to?", a single white card with From / To / Out–Back / Who rows, two trip-type chips, the promise paragraph, and a full-width navy "Search flights" button. No split-flap board anywhere.

Tab through with the keyboard.
Expected: every control takes focus, focus ring is a visible navy outline, the airport dropdown still opens and arrow keys still move the highlight.

- [ ] **Step 6: Commit**

```bash
git add app/search-experience.js app/page.module.css
git commit -m "redesign: phone-first search screen, remove split-flap board"
```

---

### Task 4: Results header and the honest read

**Files:**
- Modify: `app/search-experience.js:1049-1108` (results head + verdict block), and delete `useCountUp` (`:25-43`) and `CountUpPrice` (`:84-97`)
- Modify: `app/page.module.css` — `.results .resultsHead .meta .dot .sep .newSearch .verdict .verdictTag .readList .readItem .readDot .readText .priceInsight .priceInsightDot .sectionLabel .price .priceValue .priceCurrency .priceUnit`

**Interfaces:**
- Consumes: `.wrap`, tokens.
- Produces: `.searchbar` (the sticky context header) and `.read` (the navy finding block). `renderHonestLine(line, flights)` keeps its existing signature and still returns an array of nodes; only the class names it emits are restyled.

- [ ] **Step 1: Delete the count-up animation**

Delete `useCountUp` (lines 25–43) and `CountUpPrice` (lines 84–97). A price that animates on arrival is decorative motion in a task surface, and Record shows prices as mono digits that must not wobble. `usePrefersReducedMotion` stays — the card stagger and `FlapText` removal still reference it until Task 5.

- [ ] **Step 2: Replace the results header JSX**

Replace the `<div className={styles.resultsHead}>…</div>` block (lines 1051–1072) with:

```jsx
          <div className={styles.searchbar}>
            <div>
              <p className={styles.searchRoute}>
                {form.origin} → {form.destination}
              </p>
              <p className={styles.searchMeta} role="status" aria-live="polite">
                {(() => {
                  const nights = nightsBetween(form.depart, form.returnDate);
                  return [
                    CABIN_LABEL[form.cabin] || form.cabin,
                    nights ? `${nights} ${nights === 1 ? "night" : "nights"}` : null,
                    `${data.flights.length} ${data.source === "serpapi" ? "live fares" : "demo fares"} read`,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                })()}
              </p>
            </div>
            <button type="button" className={styles.newSearch} onClick={resetSearch}>
              Edit
            </button>
          </div>
```

The old `.dot` status dot and `.sep` separators are gone — the meta line is one plain sentence built from real values, which reads faster on a phone than a row of dot-separated chips.

- [ ] **Step 3: Replace the honest-read JSX**

Replace the `<section className={styles.verdict}>…</section>` block (lines 1091–1108) with:

```jsx
              <section className={styles.read} aria-labelledby="honest-read-title">
                <h2 id="honest-read-title" className={styles.readKicker}>
                  The honest read
                </h2>
                {data.summary
                  .split("\n")
                  .filter(Boolean)
                  .map((line, i) => (
                    <p key={i} className={styles.readLine}>
                      {renderHonestLine(noEmDash(line), data.flights)}
                    </p>
                  ))}
                <p className={styles.readFine}>
                  Ranked by what these fares actually cost you. Never by what anyone pays us.
                </p>
              </section>
```

The bulleted list with accent dots becomes plain paragraphs — inside a filled navy block the dots were decoration, and paragraphs let each line breathe at 19px.

- [ ] **Step 4: Move the price-insight line below the read**

The `priceInsightLine` block (lines 1082–1087) currently renders *above* the verdict. Move it to render immediately *after* the `</section>` of the read, and change its class usage to:

```jsx
              {priceInsightLine(data.priceInsights) && (
                <p className={styles.insight}>{priceInsightLine(data.priceInsights)}</p>
              )}
```

Delete the `.priceInsightDot` span — the same colour-alone decoration problem.

- [ ] **Step 5: Write the results-header and read CSS**

Delete the rules for `.resultsHead .meta .dot .sep .verdict .verdictTag .readList .readItem .readDot .readText .priceInsight .priceInsightDot .price .priceValue .priceCurrency` and add:

```css
/* ---- results: sticky search context ---- */
.results { padding-top: 4px; }
.searchbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0 14px;
  background: var(--bg);
  border-bottom: 1px solid var(--line-2);
}
.searchRoute {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.searchMeta {
  margin: 2px 0 0;
  font-size: 14px;
  color: var(--ink-2);
}
.newSearch {
  margin-left: auto;
  min-height: var(--tap);
  padding: 0 12px;
  border: none;
  background: none;
  color: var(--navy);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

/* ---- the honest read: the finding, printed in record navy ---- */
.read {
  margin-top: 18px;
  background: var(--navy);
  color: #fff;
  border-radius: var(--r);
  padding: 20px;
}
.readKicker {
  margin: 0 0 12px;
  font-size: 12.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--navy-on);
}
.readLine {
  margin: 0 0 10px;
  font-size: 19px;
  line-height: 1.42;
  letter-spacing: -0.015em;
}
.readLine:last-of-type { margin-bottom: 0; }
.readFine {
  margin: 14px 0 0;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.18);
  font-size: 14.5px;
  line-height: 1.45;
  color: var(--navy-on);
}
/* The airline name and price that renderHonestLine pulls out of each line. */
.leadAirline { font-weight: 600; }
.leadPrice { font-family: var(--mono); font-weight: 600; font-variant-numeric: tabular-nums; }

.insight {
  margin: 14px 0 0;
  font-size: 15px;
  line-height: 1.5;
  color: var(--ink-2);
}

.sectionLabel {
  margin: 26px 0 12px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
```

- [ ] **Step 6: Verify against a real search**

Run: `npm run dev`, search MIA → BER with dates ~2 months out.
Expected: sticky header with route and one meta sentence; a navy block holding the read; the price-insight line below it in grey; then the options label. No dots, no orange.

Scroll the results.
Expected: the search context header stays pinned at the top and does not overlap card content.

- [ ] **Step 7: Commit**

```bash
git add app/search-experience.js app/page.module.css
git commit -m "redesign: results header and navy honest-read block"
```

---

### Task 5: Fare card as a record

**Files:**
- Modify: `app/search-experience.js:594-750` (`FlightCard`), `:297-335` (`LegLine`), and delete `FlapText` (`:62-80`)
- Modify: `app/page.module.css` — `.cards .card .ticket .ticketMain .ticketBody .ticketStub .ticketFoot .bodyHead .airline .cheapTag .cheapIc .legs .leg .legLabel .legDate .route .times .timesArrow .dayOffset .legAirline .tradeoff .flagGood .flagCaution .flagRisk .ic .allin .muted .dim`

**Interfaces:**
- Consumes: tokens; `totalExtraFees(flight)` and `allInPrice(flight)` from `@/lib/flight-helpers` (unchanged); `clockTime`, `dayOffset`, `routeCodes` (unchanged).
- Produces: `.fare` and its `.rw` row vocabulary, reused by nothing else. `FlightCard`'s props stay exactly `{ flight, risks, verdict, search, cheapest, index }`.

- [ ] **Step 1: Delete `FlapText`**

Delete lines 62–80 (`FlapText`). Its only callers are inside `LegLine`, replaced in the next step.

- [ ] **Step 2: Rewrite `LegLine` as record rows**

Replace the whole `LegLine` function (lines 297–335) with:

```jsx
// One leg as two record rows: the clock times (mono, so columns line up) and
// the shape of the journey. `label` ("Outbound"/"Return") only appears on round
// trips, where the user genuinely has two legs to tell apart.
function LegLine({ segments, stops, totalDuration, label }) {
  if (!segments?.length) return null;
  const dep = clockTime(segments[0]?.depart);
  const arr = clockTime(segments[segments.length - 1]?.arrive);
  const off = dayOffset(segments[0]?.depart, segments[segments.length - 1]?.arrive);
  const date = shortDate(segments[0]?.depart);
  const shape = [
    stops === 0 ? "no stops" : `${stops} stop${stops === 1 ? "" : "s"}`,
    totalDuration,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <div className={styles.rw}>
        <span className={styles.rwKey}>
          {label ? `${label}${date ? ` · ${date}` : ""}` : "Route"}
        </span>
        <span className={`${styles.rwVal} ${styles.mono}`}>
          {dep && arr ? (
            <>
              {routeCodes(segments)} &nbsp;{dep} → {arr}
              {off > 0 && (
                <span
                  className={styles.dayOffset}
                  aria-label={off === 1 ? "arrives the next day" : `arrives ${off} days later`}
                >
                  +{off}
                </span>
              )}
            </>
          ) : (
            routeCodes(segments)
          )}
        </span>
      </div>
      <div className={styles.rw}>
        <span className={styles.rwKey}>Stops</span>
        <span className={styles.rwVal}>
          {shape}
          {label && segments[0]?.airline ? ` · ${segments[0].airline}` : ""}
        </span>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Rewrite the `FlightCard` body**

Replace the JSX inside `FlightCard`'s return — from `<div className={styles.ticketMain}>` through its closing `</div>` (lines 608–684) — with:

```jsx
      <div className={styles.fareHead}>
        <div>
          {(cheapest || level === "good" || level === "high-risk") && (
            <span
              className={`${styles.tag} ${
                level === "high-risk" ? styles.tagBad : cheapest ? styles.tagPick : styles.tagOk
              }`}
            >
              <span className={styles.tagIc} aria-hidden="true">{VERDICT_ICON[level]}</span>
              {level === "high-risk" ? "Check the catch" : cheapest ? "Cheapest" : "One ticket"}
            </span>
          )}
          <h2 className={styles.airline}>{flight.bookVia.name}</h2>
        </div>
        <div className={styles.amt}>
          <span className={styles.mono}>{formatMoney(flight.price, flight.currency)}</span>
          <small>{roundTrip ? "round trip" : "one way"}</small>
        </div>
      </div>

      <div className={styles.rows}>
        {roundTrip ? (
          <>
            <LegLine
              segments={flight.segments}
              stops={flight.stops}
              totalDuration={flight.totalDuration}
              label="Outbound"
            />
            <LegLine
              segments={flight.returnSegments}
              stops={flight.returnStops}
              totalDuration={flight.returnTotalDuration}
              label="Return"
            />
          </>
        ) : (
          <LegLine
            segments={flight.segments}
            stops={flight.stops}
            totalDuration={flight.totalDuration}
          />
        )}
        <div className={styles.rw}>
          <span className={styles.rwKey}>Total cost</span>
          <span className={`${styles.rwVal} ${styles.mono}`}>
            {!feesKnown
              ? "fare only · fees not listed"
              : fees > 0
                ? `~${formatMoney(allIn, flight.currency)} with bag and seat`
                : "no extra fees listed"}
          </span>
        </div>
      </div>

      {/* The one-line judgement. Colour is never the only signal — the icon and
          the sentence carry it too. */}
      {verdict?.tag && <p className={styles.say}>{noEmDash(verdict.tag)}</p>}

      {/* Warnings are ALWAYS visible, never behind the toggle. Deterministic,
          from code, not from the model. */}
      {risks.length > 0 && (
        <div className={styles.warnings}>
          {risks.map((r, i) => (
            <div key={i} className={`${styles.warn} ${styles[`warn_${r.severity}`]}`}>
              <p className={styles.warnLbl}>
                <span aria-hidden="true">{r.severity === "info" ? "i" : "▲"}</span>
                {r.severity === "info" ? "Note" : "Warning"}
              </p>
              <p className={styles.warnMsg}>{r.message}</p>
            </div>
          ))}
        </div>
      )}
```

Also change the `<article>` opening (line 604) to drop the retired ticket classes:

```jsx
    <article
      className={`${styles.fare} ${open ? styles.open : ""}`}
      style={reduce ? undefined : { animationDelay: `${index * 70}ms` }}
    >
```

- [ ] **Step 4: Write the fare-card CSS**

Delete the rules for `.card .ticket .ticketMain .ticketBody .ticketStub .ticketFoot .bodyHead .cheapTag .cheapIc .legs .leg .legLabel .legDate .route .times .timesArrow .tradeoff .flagGood .flagCaution .flagRisk .ic .allin .muted .dim` and add:

```css
.cards { display: block; }
.fare {
  background: var(--card);
  border: 1px solid var(--line-2);
  border-radius: var(--r);
  margin-bottom: 14px;
  overflow: hidden;
}
.fareHead {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 16px 13px;
}
.airline {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.02em;
}
.amt {
  font-size: 31px;
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1;
  text-align: right;
  font-variant-numeric: tabular-nums;
  flex: none;
}
.amt small {
  display: block;
  margin-top: 5px;
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 0;
  color: var(--ink-2);
}
.mono { font-family: var(--mono); font-variant-numeric: tabular-nums; }

.tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 9px;
  padding: 5px 9px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.tagIc { font-size: 11px; }
.tagPick { background: var(--navy-tint); color: var(--navy); }
.tagOk { background: var(--ok-tint); color: var(--ok); }
.tagBad { background: var(--alert-bg); color: var(--alert); }

/* The record itself: one labelled row per fact, value right-aligned. */
.rows { border-top: 1px solid var(--line); }
.rw {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 14px;
  padding: 11px 16px;
  border-bottom: 1px solid var(--line);
  font-size: 15.5px;
}
.rw:last-child { border-bottom: none; }
.rwKey { color: var(--ink-2); flex: none; }
.rwVal { font-weight: 600; text-align: right; }
.dayOffset { color: var(--alert); font-weight: 600; margin-left: 4px; }

.say {
  margin: 0;
  padding: 14px 16px;
  background: var(--sunk);
  font-size: 16px;
  line-height: 1.5;
}

/* Risk callouts. Full sentences, an icon, and a word — never colour alone. */
.warnings { padding: 14px 16px 0; }
.warn {
  border-radius: 12px;
  padding: 13px 14px;
  margin-bottom: 12px;
}
.warnLbl {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 6px;
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.warnMsg { margin: 0; font-size: 16px; line-height: 1.5; }
.warn_high { background: var(--alert-bg); border: 1px solid var(--alert); }
.warn_high .warnLbl { color: var(--alert); }
.warn_warn { background: var(--alert-bg); }
.warn_warn .warnLbl { color: var(--alert); }
.warn_info { background: var(--sunk); }
.warn_info .warnLbl { color: var(--ink-2); }
```

- [ ] **Step 5: Verify the cards**

Run: `npm run dev`, run a round-trip search.
Expected: each card shows a tag, airline, mono price, then Outbound / Stops / Return / Stops / Total cost rows with values right-aligned, then the grey judgement line, then any warnings. Prices do not animate.

Check a one-way search.
Expected: a single "Route" row, not "Outbound".

- [ ] **Step 6: Commit**

```bash
git add app/search-experience.js app/page.module.css
git commit -m "redesign: fare card as a labelled record"
```

---

### Task 6: Expanded detail — timeline, costs, how to book

**Files:**
- Modify: `app/search-experience.js:686-747` (`ticketFoot` / detail block) and `BookOptions` (`:508-587`)
- Modify: `app/page.module.css` — `.toggle .chev .detail .detailInner .detailPad .segments .segHead .book .bookSoon .bookWrap .bookPanel .bookNote .bookList .bookOption .bookOptionHead .bookSeller .bookTag .bookTagDirect .bookTagThird .bookFare .bookPrice .bookWarn .bookConds .bookBags .bookForm .bookGo`

**Interfaces:**
- Consumes: `BookOptions({ token, search })` and `BookForm({ redirect, label })` — both keep their exact current props and fetch behaviour.
- Produces: `.stops` timeline and `.costs` table markup, used only inside the expanded detail.

- [ ] **Step 1: Replace the segment list with a stop timeline**

Inside the detail block, replace the `<ul className={styles.segments}>…</ul>` (lines 702–719) with:

```jsx
              <ol className={styles.stops}>
                {roundTrip && <li className={styles.stopsHead}>Outbound</li>}
                {flight.segments.map((s, i) => (
                  <li key={`o${i}`} className={styles.stop}>
                    <span className={styles.stopT}>
                      <span className={styles.mono}>{clockTime(s.depart)}</span> {s.from} → {s.to}
                    </span>
                    <span className={styles.stopP}>
                      {s.airline} {s.flightNo} · {s.duration}
                    </span>
                  </li>
                ))}
                {roundTrip && flight.returnSegments?.length > 0 && (
                  <>
                    <li className={styles.stopsHead}>Return</li>
                    {flight.returnSegments.map((s, i) => (
                      <li key={`r${i}`} className={styles.stop}>
                        <span className={styles.stopT}>
                          <span className={styles.mono}>{clockTime(s.depart)}</span> {s.from} → {s.to}
                        </span>
                        <span className={styles.stopP}>
                          {s.airline} {s.flightNo} · {s.duration}
                        </span>
                      </li>
                    ))}
                  </>
                )}
              </ol>
```

- [ ] **Step 2: Change the toggle label and chevron**

Replace the toggle button (lines 688–696) with:

```jsx
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <span>{open ? "Hide the detail" : "See every flight and fee"}</span>
          <svg
            className={styles.chev}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
```

The `↓` text arrow becomes a real SVG so it matches the two SVG icons already in `TravelersControl`, and the label now says what the user gets.

- [ ] **Step 3: Write the detail CSS**

Delete the rules for `.segments .segHead` and add, replacing the existing `.toggle`, `.chev`, `.detail*`, and `.book*` rules:

```css
.toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 52px;
  padding: 0 16px;
  border: none;
  border-top: 1px solid var(--line);
  background: none;
  color: var(--navy);
  font-size: 15.5px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.toggle:focus-visible { outline: 2px solid var(--navy); outline-offset: -2px; }
.chev { transition: transform 180ms ease; flex: none; }
.open .chev { transform: rotate(180deg); }

.detail { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 220ms ease; }
.open .detail { grid-template-rows: 1fr; }
.detailInner { overflow: hidden; }
.detailPad { padding: 4px 16px 18px; }
.detailPad p { font-size: 16px; line-height: 1.55; margin: 0 0 10px; }

/* Every flight, in order, on one line each. */
.stops { list-style: none; margin: 0 0 16px; padding: 0; }
.stopsHead {
  font-size: 12.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-2);
  font-weight: 600;
  margin: 12px 0 6px;
}
.stopsHead:first-child { margin-top: 0; }
.stop {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px solid var(--line);
}
.stopT { font-size: 16px; font-weight: 600; }
.stopP { font-size: 14.5px; color: var(--ink-2); text-align: right; }

/* How to book */
.bookWrap { margin-top: 14px; }
.bookPanel { margin-top: 10px; }
.bookNote { font-size: 15px; color: var(--ink-2); line-height: 1.5; }
.bookList { list-style: none; margin: 12px 0 0; padding: 0; }
.bookOption {
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 10px;
  background: var(--card);
}
.bookOptionHead {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 8px;
}
.bookSeller { font-size: 16.5px; font-weight: 600; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.bookPrice { font-family: var(--mono); font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; }
.bookTag {
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 3px 7px;
  border-radius: 5px;
}
.bookTagDirect { background: var(--ok-tint); color: var(--ok); }
.bookTagThird { background: var(--sunk); color: var(--ink-2); }
.bookFare { font-size: 14px; color: var(--ink-2); font-weight: 400; }
.bookWarn {
  margin: 8px 0;
  padding: 11px 12px;
  border-radius: 10px;
  background: var(--alert-bg);
  color: var(--ink);
  font-size: 15.5px;
  line-height: 1.5;
}
.bookConds { margin: 8px 0; padding-left: 18px; font-size: 15px; color: var(--ink-2); }
.bookBags { font-size: 15px; color: var(--ink-2); margin: 8px 0 0; }
.bookForm { margin-top: 12px; }
.bookGo, .book {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 50px;
  border: none;
  border-radius: 12px;
  background: var(--navy);
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}
.bookGo:hover, .book:hover { background: var(--navy-2); }
.bookSoon { font-size: 15px; color: var(--ink-2); }
```

- [ ] **Step 4: Verify the detail expands and booking still works**

Run: `npm run dev`, run a live search, expand a card, then open "How to book".
Expected: the panel expands smoothly, the chevron rotates, a network request to `/api/book-options` fires only on that click (check the Network tab), and seller options render with a full-width navy "Continue to …" button.

Turn on OS reduced motion and expand again.
Expected: it opens instantly with no transition, and the content is identical.

- [ ] **Step 5: Commit**

```bash
git add app/search-experience.js app/page.module.css
git commit -m "redesign: expanded detail timeline and booking panel"
```

---

### Task 7: Loading, error, and empty states

**Files:**
- Modify: `app/search-experience.js:1036-1047` (loading + error) and `:1074-1077` (empty), `:1139-1141` (demo foot)
- Modify: `app/page.module.css` — `.loading .spinner .error .empty .foot`

**Interfaces:**
- Consumes: tokens; `.fare` shape from Task 5 (the skeleton mimics it).
- Produces: `.skeleton` markup used only while `loading` is true.

- [ ] **Step 1: Replace the loading spinner with skeleton cards**

Replace the loading block (lines 1036–1041) with:

```jsx
      {loading && (
        <div className={styles.loadingWrap}>
          <p className={styles.loadingNote} role="status" aria-live="polite">
            Reading the real options and the fine print…
          </p>
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.skeleton} aria-hidden="true">
              <div className={styles.skLine} style={{ width: "45%", height: 20 }} />
              <div className={styles.skLine} style={{ width: "72%" }} />
              <div className={styles.skLine} style={{ width: "60%" }} />
            </div>
          ))}
        </div>
      )}
```

A spinner in the middle of content tells the user nothing; three card-shaped placeholders tell them what is arriving and stop the layout jumping when it does.

- [ ] **Step 2: Write the state CSS**

Delete `.spinner` and its `@keyframes`, and replace `.loading`, `.error`, `.empty`, `.foot` with:

```css
.loadingWrap { padding-top: 18px; }
.loadingNote { margin: 0 0 14px; font-size: 16px; color: var(--ink-2); }
.skeleton {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--r);
  padding: 18px 16px;
  margin-bottom: 14px;
}
.skLine {
  height: 13px;
  border-radius: 6px;
  background: var(--sunk);
  margin-bottom: 11px;
  animation: pulse 1.4s ease-in-out infinite;
}
.skLine:last-child { margin-bottom: 0; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }

.error {
  margin: 18px 0 0;
  padding: 16px;
  border-radius: var(--r);
  background: var(--alert-bg);
  border: 1px solid var(--alert);
  color: var(--ink);
  font-size: 16px;
  line-height: 1.5;
}
.empty {
  margin: 18px 0 0;
  padding: 22px 18px;
  border-radius: var(--r);
  background: var(--card);
  border: 1px solid var(--line-2);
  font-size: 17px;
  line-height: 1.5;
  color: var(--ink);
}
.foot { margin: 22px 0 0; font-size: 14.5px; color: var(--ink-2); }
.fieldError { display: block; margin-top: 4px; font-size: 14px; color: var(--alert); }
```

- [ ] **Step 3: Verify all three states**

Run: `npm run dev`. Submit with an empty From field.
Expected: the red-bordered `.error` block appears with the existing message; the field shows `.fieldError` in red.

Search a route with no service on those dates (e.g. a tiny regional pair).
Expected: the calm `.empty` card, not the red error.

Watch the moment between submitting and results.
Expected: three skeleton cards pulsing, and no layout jump when the real cards replace them.

- [ ] **Step 4: Commit**

```bash
git add app/search-experience.js app/page.module.css
git commit -m "redesign: skeleton loading, error and empty states"
```

---

### Task 8: Autocomplete and travelers popover

**Files:**
- Modify: `app/page.module.css` — `.autocomplete .suggestions .suggestion .suggestionCity .suggestionUnderCity .suggestionActive .suggestionType .travelersWrap .travelers .travelersIcon .travelersChev .travelersCount .travelersPanel .counterRow .counterLabel .counterHint .counter .counterBtn .counterValue .travelersDone .cabinSelect`

**Interfaces:**
- Consumes: `.field` / `.fieldRow` from Task 3. No JSX changes in this task — `AirportField` and `TravelersControl` markup and a11y attributes stay exactly as they are.

- [ ] **Step 1: Restyle both popovers**

Replace the existing rules for the classes listed above with:

```css
.autocomplete { position: relative; flex: 1; min-width: 0; }
.suggestions {
  position: absolute;
  top: calc(100% + 8px);
  left: -16px;
  right: -16px;
  z-index: 40;
  margin: 0;
  padding: 6px;
  list-style: none;
  max-height: 320px;
  overflow-y: auto;
  background: var(--card);
  border: 1px solid var(--line-2);
  border-radius: var(--r);
  box-shadow: 0 12px 30px rgba(18, 23, 26, 0.14);
}
.suggestion {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: var(--tap);
  padding: 10px 12px;
  border: none;
  border-radius: var(--r-sm);
  background: none;
  color: var(--ink);
  font-size: 16px;
  text-align: left;
  cursor: pointer;
}
.suggestionCity { font-weight: 600; }
.suggestionUnderCity { padding-left: 24px; }
.suggestionActive { background: var(--navy-tint); color: var(--navy); }
.suggestionType { font-size: 13.5px; color: var(--ink-2); flex: none; }

.travelersWrap { position: relative; flex: 1; min-width: 0; }
.travelers {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: var(--tap);
  padding: 0 12px;
  border: 1px solid var(--line-2);
  border-radius: var(--r-sm);
  background: var(--card);
  color: var(--ink);
  font-size: 16px;
  cursor: pointer;
}
.travelersIcon, .travelersChev { flex: none; color: var(--ink-2); }
.travelersCount { flex: 1; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.travelersPanel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 40;
  padding: 8px;
  background: var(--card);
  border: 1px solid var(--line-2);
  border-radius: var(--r);
  box-shadow: 0 12px 30px rgba(18, 23, 26, 0.14);
}
.counterRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 6px;
}
.counterLabel { font-size: 16px; }
.counterHint { display: block; font-size: 13.5px; color: var(--ink-2); }
.counter { display: flex; align-items: center; gap: 4px; }
.counterBtn {
  width: var(--tap);
  height: var(--tap);
  border: 1px solid var(--line-2);
  border-radius: var(--r-sm);
  background: var(--card);
  color: var(--ink);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.counterBtn:disabled { opacity: 0.38; cursor: default; }
.counterValue { min-width: 32px; text-align: center; font-size: 17px; font-weight: 600; font-variant-numeric: tabular-nums; }
.travelersDone {
  width: 100%;
  min-height: 48px;
  margin-top: 6px;
  border: none;
  border-radius: var(--r-sm);
  background: var(--navy);
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.cabinSelect {
  flex: 1;
  min-width: 0;
  min-height: var(--tap);
  padding: 0 10px;
  border: 1px solid var(--line-2);
  border-radius: var(--r-sm);
  background: var(--card);
  color: var(--ink);
  font-size: 16px;
  cursor: pointer;
}

.travelers:focus-visible,
.counterBtn:focus-visible,
.travelersDone:focus-visible,
.suggestion:focus-visible,
.newSearch:focus-visible,
.toggle:focus-visible {
  outline: 2px solid var(--navy);
  outline-offset: 2px;
}
```

- [ ] **Step 2: Verify both popovers on a phone width**

Run: `npm run dev` at 390px. Type "ber" in To.
Expected: the dropdown spans the full card width, city rows are bold, airports indent under them, the arrow-key highlight is a navy tint, and every row is at least 44px tall.

Open Travelers, tap + and − to the limits.
Expected: buttons are 44×44, disabled buttons visibly dim and do nothing, Escape and an outside tap both close the panel.

- [ ] **Step 3: Commit**

```bash
git add app/page.module.css
git commit -m "redesign: autocomplete and travelers popover"
```

---

### Task 9: Sweep, verify, and document

**Files:**
- Modify: `app/page.module.css` (delete dead rules)
- Rewrite: `DESIGN.md`
- Modify: `PRODUCT.md` (Brand Personality, the "Visual identity" sentence)

**Interfaces:**
- Consumes: everything above. Produces the durable record of the system.

- [ ] **Step 1: Delete every dead CSS rule**

Search `app/page.module.css` for these class names and delete any rule that survives — they have no JSX left referencing them:

`.board .boardGhost .flap .flapText .flapChar .code .arrow .hero .heroCompact .heroIntro .heroPitch .heroForm .kicker .subtitle .formTitle .contextStrip .segmented .segment .segmentActive .row .ticket .ticketMain .ticketBody .ticketStub .ticketFoot .bodyHead .cheapTag .cheapIc .legs .leg .legLabel .legDate .route .times .timesArrow .legAirline .tradeoff .flagGood .flagCaution .flagRisk .ic .price .priceValue .priceCurrency .priceUnit .allin .muted .dim .dot .sep .meta .resultsHead .verdict .verdictTag .readList .readItem .readDot .readText .priceInsight .priceInsightDot .segments .segHead .spinner .loading .card`

- [ ] **Step 2: Confirm nothing references a deleted class**

Run: `grep -o "styles\.[a-zA-Z_][a-zA-Z0-9_]*" app/search-experience.js | sort -u`

Cross-check every name in that output against the class names defined in `app/page.module.css`. Expected: every referenced class exists. A missing one renders as `undefined` in the DOM and silently loses all styling.

- [ ] **Step 3: Run the full check**

```bash
npm run lint
npm test
npm run build
```

Expected: lint clean, all existing `lib/` tests pass (they never touched the UI — this proves no import broke), production build succeeds with no warnings about missing modules.

- [ ] **Step 4: Check the three viewports and the contrast bar**

Open `http://localhost:3000` and walk a full search at **390px**, **768px**, and **1280px**.

At every width confirm:
- No horizontal scroll.
- The column stays centred and stops at 560px.
- The sticky search header never covers card content.
- Every touch target measures ≥44px (use the browser inspector's box model).

Then in DevTools, sample these pairs with the contrast checker:
- `--ink-2` (#586267) on `--card` (#ffffff) — expect ≥ 4.5:1
- `--ink-2` on `--bg` (#eef0ee) — expect ≥ 4.5:1
- `--navy-on` (#a8c0e6) on `--navy` (#1e3f77) — expect ≥ 4.5:1
- `--alert` (#9c2028) on `--alert-bg` (#fbeeee) — expect ≥ 4.5:1
- `--ok` (#1c6b52) on `--ok-tint` (#e2efe9) — expect ≥ 4.5:1

If any pair falls short, darken the foreground token in `globals.css` until it passes and re-check — do not ship a failing pair.

- [ ] **Step 5: Rewrite `DESIGN.md`**

Replace the file entirely. The YAML frontmatter must list exactly the tokens now in `globals.css` (same names, same hex values — a drifting DESIGN.md is worse than none). The prose sections must state:

- **Creative North Star: "The Record."** FareWise looks like a document you'd be handed by someone who has no stake in what you choose: cool paper grey, white cards, every fact a labelled row with the value right-aligned, and the verdict printed as a finding in record navy. It is light because people compare fares in daylight on a phone, and high-contrast because the honest read is the product.
- **Named rules to carry forward:** *The One Navy Rule* (navy marks the finding and the primary action, nothing else — a screen with three navy blocks has two too many). *The Signal-Never-Alone Rule* (green/red always ship with an icon and a word). *The Mono-for-Digits Rule* (times, prices, and codes are mono so columns line up; every human sentence is sans).
- **Explicit retirement:** the Departure Board system — night navy, signal orange, split-flap board, atmosphere glow, scanlines — is retired, not paused. Do not reintroduce any of it.
- **Do NOT:** orange, cream, neon, faux paper texture, perforation, hatch fill, scanline, gradient hero-metric, card-grid dashboard, booking-site urgency, travel-blogger gloss.
- **Dark theme:** not built. When it is, it is one `@media (prefers-color-scheme: dark)` block in `globals.css` redefining the same token names, and nothing downstream changes.

- [ ] **Step 6: Update the one stale sentence in `PRODUCT.md`**

In *Brand Personality*, replace the sentence beginning "Visual identity (already committed, preserve it): 'airport departure board at night'…" with:

```md
Visual identity (already committed, preserve it): "the record" — cool paper grey page, white cards, every fact a labelled row with its value right-aligned, and the verdict printed as a finding in deep record navy. One alert red for the catch. Light, high-contrast, phone-first. Calm and authoritative, not loud.
```

- [ ] **Step 7: Commit**

```bash
git add app/page.module.css DESIGN.md PRODUCT.md
git commit -m "redesign: retire Departure Board, document the Record system"
```

---

## Self-Review

**Spec coverage.** Every screen in the approved mockup maps to a task: search screen → Task 3; results header and honest read → Task 4; fare cards → Task 5; the opened detail → Task 6. The mockup shows no loading, error, empty, autocomplete, or travelers state, so Tasks 7 and 8 extend the system into them rather than copying a frame — that is deliberate and called out in each task's intro.

**Known gaps, stated rather than hidden.**

1. The approved mockup's third frame is a full-page detail *screen*; the app has an inline expanding detail *panel* inside the card. Task 6 keeps the inline panel — converting to routed detail screens is a navigation change, not a visual one, and it is out of scope here. The mockup's stop timeline is carried into the panel.
2. The mockup's itemised cost table (fare / bag / second bag / total) is **not** built. SerpApi returns no à-la-carte fees, so `feesKnown` is `false` on real searches and the table would be empty rows on every live result. The honest equivalent is the single "Total cost" row in Task 5, which states `fare only · fees not listed` when we genuinely don't know. Build the table only if a data source ever supplies itemised fees.

**Not verified before writing.** These mockups were never rendered in a browser (Chrome screenshot injection times out against localhost in this environment). Expect Task 3 and Task 5 to need spacing corrections once seen on a real device.
