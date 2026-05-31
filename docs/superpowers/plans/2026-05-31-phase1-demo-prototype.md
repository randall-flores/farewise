# FareWise Phase 1 — Demo Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove FareWise's value: a search form → hardcoded demo flights → a server-side route that asks Claude to explain the trade-offs honestly → a results page showing flights + Claude's plain-language read + a "book direct" redirect.

**Architecture:** Next.js 16 App Router, plain CSS. **Single-page flow** — the home page renders a hero plus one client component that holds both the search form and the results below it. On submit, that component POSTs the search to one server-side route handler (`/api/explain`); results render in place under the form (no second route, no URL params to manage). That route is the *only* place Claude is called — it loads the demo flights, computes deterministic risk flags in code, asks Claude to explain the options under strict honesty rules, and returns `{ flights, riskMap, explanation }`. The Anthropic key lives in `.env.local` and never reaches the browser.

**Tech Stack:** Next.js 16.2.6 (App Router, JavaScript), React 19, `@anthropic-ai/sdk`, plain CSS (globals + CSS Modules), `next/font/google` (Fraunces + Public Sans). Model: `claude-sonnet-4-6` (one-line switch in `lib/anthropic.js`).

**Testing note (deviation from default TDD):** Per CLAUDE.md (beginner, clear-over-clever, don't over-engineer Phase 1) we verify each task by running the app — lint, curl the route, load pages, confirm the key is server-only. Automated tests for the risk helpers come in a later phase.

**Non-negotiables enforced by this plan:**
- Live-data-only → route reasons only over `demoFlights`; nothing invented. System prompt forbids inventing fares/routes.
- No urgency/scarcity, no money-driven ranking → encoded in the system prompt.
- Warn loudly on risk → `detectRisks()` computes flags in code (deterministic), passed to Claude as ground truth and rendered on each card.
- Key security → Claude only called in `app/api/explain/route.js` (server); key read via `process.env`, never `NEXT_PUBLIC_`.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `app/globals.css` | Design tokens (color, type) + base element styles. Rewritten. |
| `app/layout.js` | Root layout: load fonts, set metadata, apply font CSS vars. Rewritten. |
| `lib/demo-flights.js` | Hardcoded demo flights in the brief's `flightResult` shape. |
| `lib/flight-helpers.js` | Pure helpers: `formatMoney`, `totalExtraFees`, `durationToMinutes`, `detectRisks` (honesty core). Isomorphic (safe on client + server). |
| `lib/anthropic.js` | **Server-only.** Anthropic client, MODEL setting, system prompt, prompt builder, `getExplanation`. |
| `app/api/explain/route.js` | The only Claude caller. POST → demo flights + risk flags + Claude explanation. |
| `app/page.js` | Home page (server component) — hero + `<SearchExperience/>`. |
| `app/search-experience.js` | Client component — search form **and** results below it; POSTs to `/api/explain`, manages loading/error/results state. |
| `app/page.module.css` | All Phase-1 page styles: hero, form, loading, explanation, flight cards, risk flags. |

---

## Task 1: Brand foundation (fonts, tokens, layout)

**Files:**
- Modify: `app/layout.js`
- Modify: `app/globals.css`

**Concept (explain to owner):** `next/font/google` downloads fonts at build time and self-hosts them (no external request at runtime, no layout shift). We expose each font as a CSS variable (`--font-display`, `--font-body`) and use them in `globals.css`. Fraunces (characterful serif) for headings signals editorial honesty; Public Sans (clean, neutral) for body keeps data readable.

- [ ] **Step 1: Replace `app/layout.js`**

```js
import { Fraunces, Public_Sans } from "next/font/google";
import "./globals.css";

// Each font becomes a CSS variable we reference in globals.css.
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Public_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata = {
  title: "FareWise — honest flight search",
  description: "Compare flights, see the catch, book direct.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Replace `app/globals.css`**

```css
/* ---- FareWise design tokens ----
   One place for color + type so the whole app stays consistent. */
:root {
  --paper: #f7f5ef;      /* warm off-white background */
  --ink: #14181f;        /* near-black text */
  --ink-soft: #4b5563;   /* secondary text */
  --line: #e4e0d6;       /* hairline borders */
  --card: #ffffff;       /* card surface */

  --accent: #0f766e;     /* trust teal — primary actions */
  --accent-ink: #0b5048; /* darker teal for hover */

  --warn: #b45309;       /* amber — caution risk */
  --danger: #b91c1c;     /* red — high risk */
  --safe: #15803d;       /* green — reassurance */

  --radius: 14px;
  --shadow: 0 1px 2px rgba(20, 24, 31, 0.06), 0 8px 24px rgba(20, 24, 31, 0.06);
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-body), system-ui, sans-serif;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3 {
  font-family: var(--font-display), Georgia, serif;
  line-height: 1.1;
  letter-spacing: -0.01em;
  margin: 0;
}

a { color: inherit; }

button, input, select { font: inherit; }
```

- [ ] **Step 3: Verify**

Run: `npm run dev` (if not already running), open `http://localhost:3000`.
Expected: page renders on a warm off-white background with the serif heading font visible (the default Next.js starter content is fine here — we replace it in Task 6). No console errors about fonts.

- [ ] **Step 4: Commit**

```bash
git add app/layout.js app/globals.css
git commit -m "feat: FareWise brand foundation — fonts and design tokens"
```

---

## Task 2: Demo flight data

**Files:**
- Create: `lib/demo-flights.js`

**Concept:** Phase 1 has no flight API. These are hand-written flights in the exact `flightResult` shape from the brief, chosen to create real trade-offs: a balanced single-ticket, a risky cheap self-transfer, a premium nonstop, and a suspiciously low possible-mistake fare. The rest of the app never knows the data is fake — it reads this shape.

- [ ] **Step 1: Create `lib/demo-flights.js`**

```js
// lib/demo-flights.js
// Hand-written demo flights for Phase 1, in the normalized FareWise shape.
// Route: Miami (MIA) -> Berlin (BER). Picked to expose honest trade-offs.
export const demoFlights = [
  {
    id: "fw_001",
    price: 420,
    currency: "USD",
    cabin: "economy",
    totalDuration: "11h 30m",
    stops: 1,
    segments: [
      { from: "MIA", to: "LIS", airline: "TAP", flightNo: "TP202", depart: "2026-07-10T18:40", arrive: "2026-07-11T07:10", duration: "7h 30m" },
      { from: "LIS", to: "BER", airline: "TAP", flightNo: "TP534", depart: "2026-07-11T09:00", arrive: "2026-07-11T13:10", duration: "3h 10m" },
    ],
    bookingType: "single-ticket",
    protected: true,
    layover: "1h 50m",
    baggage: { carryOn: true, checked: 0 },
    extraFees: { firstBag: 35, seatSelect: 12, payment: 0 },
    refundable: false,
    cabinOptions: [
      { cabin: "economy", price: 420 },
      { cabin: "business", price: 1310, perks: ["lie-flat", "lounge", "2 checked bags"] },
    ],
    bookVia: { name: "TAP Air Portugal", url: "https://placeholder-affiliate-link" },
  },
  {
    id: "fw_002",
    price: 360,
    currency: "USD",
    cabin: "economy",
    totalDuration: "13h 05m",
    stops: 1,
    segments: [
      { from: "MIA", to: "LGW", airline: "Norse", flightNo: "Z0701", depart: "2026-07-10T20:15", arrive: "2026-07-11T08:20", duration: "7h 05m" },
      { from: "STN", to: "BER", airline: "Ryanair", flightNo: "FR8021", depart: "2026-07-11T09:30", arrive: "2026-07-11T12:20", duration: "2h 50m" },
    ],
    bookingType: "self-transfer",
    protected: false,
    layover: "1h 10m",
    baggage: { carryOn: true, checked: 0 },
    extraFees: { firstBag: 60, seatSelect: 18, payment: 5 },
    refundable: false,
    cabinOptions: [{ cabin: "economy", price: 360 }],
    bookVia: { name: "Norse Atlantic", url: "https://placeholder-affiliate-link" },
  },
  {
    id: "fw_003",
    price: 690,
    currency: "USD",
    cabin: "economy",
    totalDuration: "9h 55m",
    stops: 0,
    segments: [
      { from: "MIA", to: "BER", airline: "Lufthansa", flightNo: "LH463", depart: "2026-07-10T17:25", arrive: "2026-07-11T08:20", duration: "9h 55m" },
    ],
    bookingType: "single-ticket",
    protected: true,
    layover: "",
    baggage: { carryOn: true, checked: 1 },
    extraFees: { firstBag: 0, seatSelect: 25, payment: 0 },
    refundable: false,
    cabinOptions: [
      { cabin: "economy", price: 690 },
      { cabin: "business", price: 2100, perks: ["lie-flat", "lounge", "priority", "2 checked bags"] },
    ],
    bookVia: { name: "Lufthansa", url: "https://placeholder-affiliate-link" },
  },
  {
    id: "fw_004",
    price: 188,
    currency: "USD",
    cabin: "economy",
    totalDuration: "16h 20m",
    stops: 1,
    segments: [
      { from: "MIA", to: "FRA", airline: "Condor", flightNo: "DE2099", depart: "2026-07-10T22:05", arrive: "2026-07-11T12:40", duration: "8h 35m" },
      { from: "FRA", to: "BER", airline: "Condor", flightNo: "DE1188", depart: "2026-07-11T18:45", arrive: "2026-07-11T19:55", duration: "1h 10m" },
    ],
    bookingType: "single-ticket",
    protected: true,
    layover: "6h 05m",
    baggage: { carryOn: true, checked: 0 },
    extraFees: { firstBag: 40, seatSelect: 10, payment: 0 },
    refundable: false,
    cabinOptions: [{ cabin: "economy", price: 188 }],
    bookVia: { name: "Condor", url: "https://placeholder-affiliate-link" },
  },
];
```

- [ ] **Step 2: Verify**

Run: `npm run lint`
Expected: no errors for `lib/demo-flights.js`.

- [ ] **Step 3: Commit**

```bash
git add lib/demo-flights.js
git commit -m "feat: add hand-written demo flight dataset"
```

---

## Task 3: Flight helper functions (honesty core)

**Files:**
- Create: `lib/flight-helpers.js`

**Concept:** Pure functions — no React, no network, easy to reason about and reuse on both server and client. `detectRisks` is the honesty core: it flags self-transfers, tight connections, possible mistake fares, and heavy add-on fees *in code*, so a warning always exists even if the AI misses it.

- [ ] **Step 1: Create `lib/flight-helpers.js`**

```js
// lib/flight-helpers.js
// Pure helpers for flight data. Safe to import on server and client.

// Format a number as money, e.g. 420 -> "$420".
export function formatMoney(amount, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Sum the "checkout surprise" fees so we can surface a truer cost.
export function totalExtraFees(flight) {
  const f = flight.extraFees || {};
  return (f.firstBag || 0) + (f.seatSelect || 0) + (f.payment || 0);
}

// Parse "1h 50m" / "1h" / "50m" into minutes. Returns null if unknown/empty.
export function durationToMinutes(text) {
  if (!text) return null;
  const h = /(\d+)\s*h/.exec(text);
  const m = /(\d+)\s*m/.exec(text);
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

// The honesty core: flag risky options in plain language.
// Deterministic so a warning always exists even if the AI misses it.
export function detectRisks(flight, allFlights = []) {
  const risks = [];

  if (flight.bookingType === "self-transfer") {
    risks.push({
      type: "self-transfer",
      severity: flight.protected ? "warn" : "high",
      message: flight.protected
        ? "Separate tickets (self-transfer). You're covered if you misconnect, but a missed leg still means delays."
        : "Separate tickets (self-transfer) with NO protection. Miss the first leg and you may lose the second ticket entirely.",
    });
  }

  const layoverMin = durationToMinutes(flight.layover);
  if (layoverMin !== null && flight.stops > 0 && layoverMin < 90) {
    risks.push({
      type: "tight-connection",
      severity: layoverMin < 60 ? "high" : "warn",
      message: `Tight ${flight.layover} connection — little room if the first flight runs late.`,
    });
  }

  // Possible mistake fare: far below the typical price of the other options.
  const others = allFlights.filter((x) => x.id !== flight.id).map((x) => x.price);
  if (others.length) {
    const sorted = [...others].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (flight.price < median * 0.55) {
      risks.push({
        type: "possible-mistake-fare",
        severity: "warn",
        message: "Suspiciously low price — could be a mistake fare the airline may cancel. Don't build non-refundable plans around it.",
      });
    }
  }

  const fees = totalExtraFees(flight);
  if (fees >= 50) {
    risks.push({
      type: "high-extra-fees",
      severity: "info",
      message: `About ${formatMoney(fees, flight.currency)} in likely add-ons (bags/seat) on top of the headline price.`,
    });
  }

  return risks;
}
```

- [ ] **Step 2: Verify**

Run: `npm run lint`
Expected: no errors for `lib/flight-helpers.js`.

- [ ] **Step 3: Commit**

```bash
git add lib/flight-helpers.js
git commit -m "feat: add flight helpers and deterministic risk detection"
```

---

## Task 4: Anthropic helper (server-only)

**Files:**
- Create: `lib/anthropic.js`

**Concept:** This module talks to Claude. It must never be imported into a client component (it uses the secret key). The MODEL is set in one clearly-marked place so the owner can switch models with a one-line change. The system prompt teaches Claude FareWise's non-negotiables on every call. `cache_control` on the static system prompt makes repeat searches cheaper/faster (prompt caching).

- [ ] **Step 1: Create `lib/anthropic.js`**

```js
// lib/anthropic.js
// Server-only helper that talks to Claude. NEVER import this into a client component.
import Anthropic from "@anthropic-ai/sdk";

// ── MODEL SETTING ─────────────────────────────────────────────
// Change the model here (one-line switch). Options, least -> most capable:
//   "claude-haiku-4-5"    <- fastest + cheapest
//   "claude-sonnet-4-6"   <- currently using (strong reasoning, still fast)
//   "claude-opus-4-8"     <- most capable, slower + pricier
const MODEL = "claude-sonnet-4-6";
// ──────────────────────────────────────────────────────────────

// One client, reused. Reads the key from .env.local (server-side only).
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// The rules FareWise must never break, taught to Claude on every call.
const SYSTEM_PROMPT = `You are FareWise's honesty layer for flight search.
Your job: explain the trade-offs between the flight options you are given, in plain language, so the traveler can decide for themselves.

Hard rules — never break these:
- Reason ONLY over the flight data provided in this message. Never invent, recall, or estimate any fare, route, schedule, or flight that is not in the data.
- Never state an airline's refund/baggage/change policy as fact. Explain general trade-offs, but flag specific policy details as "check with the airline".
- Never create urgency or scarcity ("book now", "prices rising"). No pressure tactics.
- Do not reorder or favor any option for commercial reasons. Rank only by genuine value to the traveler.
- Warn clearly about risky options: self-transfers / separate tickets, tight connections, and suspiciously low (possible mistake) fares.
- When cabinOptions exist, explain the cost delta of upgrading and whether it's worth it.

Be concise, warm, and specific. Use the real numbers from the data.`;

// Build the user message: the search + the flights as JSON + precomputed risk flags.
export function buildExplainPrompt(flights, search, riskMap) {
  return `Traveler searched: ${search.origin} -> ${search.destination}, departing ${search.depart}${
    search.returnDate ? ", returning " + search.returnDate : ""
  }, cabin: ${search.cabin}.

Here are the ONLY flight options to consider (JSON):
${JSON.stringify(flights, null, 2)}

Deterministic risk flags we already detected (treat as ground truth, weave into your explanation):
${JSON.stringify(riskMap, null, 2)}

Write a short comparison that covers:
1. Which option is best for whom (e.g. budget-first vs. peace-of-mind), using the real prices.
2. The key trade-offs (time, stops, baggage, total cost including the extra fees).
3. Any risk or catch, stated plainly.
4. The cabin-upgrade delta where cabinOptions exist — is the jump worth it?

Plain text, no markdown headers. A few short paragraphs.`;
}

// Call Claude and return the explanation text.
export async function getExplanation(flights, search, riskMap) {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    // cache_control caches this static system prompt so repeat searches are cheaper/faster.
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: buildExplainPrompt(flights, search, riskMap) }],
  });

  // The SDK returns content as an array of blocks; join the text blocks.
  return msg.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
```

- [ ] **Step 2: Verify**

Run: `npm run lint`
Expected: no errors for `lib/anthropic.js`.

- [ ] **Step 3: Commit**

```bash
git add lib/anthropic.js
git commit -m "feat: add server-only Anthropic helper with honesty system prompt"
```

---

## Task 5: The explain API route (only Claude caller)

**Files:**
- Create: `app/api/explain/route.js`
- Precondition: real key in `.env.local` (`ANTHROPIC_API_KEY=sk-ant-...`).

**Concept:** A Route Handler — `app/api/explain/route.js` exporting `POST`. It runs only on the server, so the key is safe. It loads demo flights, computes risk flags in code, asks Claude, and returns JSON. Errors return a clean message instead of crashing.

- [ ] **Step 1: Create `app/api/explain/route.js`**

```js
// app/api/explain/route.js
// The ONLY place Claude is called. Runs on the server — the API key never reaches the browser.
import { demoFlights } from "@/lib/demo-flights";
import { detectRisks } from "@/lib/flight-helpers";
import { getExplanation } from "@/lib/anthropic";

export async function POST(request) {
  try {
    const search = await request.json();

    // Phase 1: data is the hardcoded demo set (no real flight API yet).
    // We only ever reason over THIS data — nothing invented.
    const flights = demoFlights;

    // Deterministic honesty flags, computed in code (not left to the AI).
    const riskMap = {};
    for (const f of flights) riskMap[f.id] = detectRisks(f, flights);

    const explanation = await getExplanation(flights, search, riskMap);

    return Response.json({ flights, riskMap, explanation });
  } catch (err) {
    console.error("explain route error:", err);
    return Response.json(
      { error: "Could not generate an explanation. Check the server logs and your ANTHROPIC_API_KEY." },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Add the key and restart dev**

Edit `.env.local` → set `ANTHROPIC_API_KEY=sk-ant-...` (real key).
Restart the dev server (env files load at startup): stop `npm run dev`, run it again.

- [ ] **Step 3: Verify the route returns an explanation**

Run (PowerShell):

```powershell
$body = '{"origin":"MIA","destination":"BER","depart":"2026-07-10","returnDate":"","cabin":"economy"}'
Invoke-RestMethod -Uri http://localhost:3000/api/explain -Method Post -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 6
```

Expected: JSON containing `flights` (4 items), `riskMap` (risk arrays per id, e.g. `fw_002` has a high-severity self-transfer flag), and a non-empty `explanation` string from Claude.
If you see the `error` field instead: the key is missing/invalid — fix `.env.local` and restart.

- [ ] **Step 4: Confirm the key is server-only**

Run: `npm run build`, then search the client bundle:

```powershell
Select-String -Path ".next/static/**/*.js" -Pattern "sk-ant-" -SimpleMatch
```

Expected: **no matches** (the key is never shipped to the browser).

- [ ] **Step 5: Commit**

```bash
git add app/api/explain/route.js
git commit -m "feat: add /api/explain route — server-side Claude explanation"
```

---

## Task 6: Home page + search experience (form + results on one page)

**Files:**
- Create: `app/search-experience.js`
- Modify: `app/page.js` (replace starter content)
- Create: `app/page.module.css`

**Concept:** The page (`app/page.js`) stays a **Server Component** — it just renders the static hero and drops in one Client Component. `app/search-experience.js` is the Client Component (`'use client'`): it holds the form state *and* the results state. On submit it POSTs the search to `/api/explain`, shows a spinner, then renders Claude's explanation + a flight card per result **right below the form** — no second route, no URL params. Small helper components (`FlightCard`) live in the same file to keep Phase 1 easy to read.

- [ ] **Step 1: Create `app/search-experience.js`**

```js
"use client";
import { useState } from "react";
import { formatMoney, totalExtraFees } from "@/lib/flight-helpers";
import styles from "./page.module.css";

// One flight result card. Shows price, segments, risk flags, and a book-direct link.
function FlightCard({ flight, risks }) {
  const fees = totalExtraFees(flight);
  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <div>
          <p className={styles.airline}>{flight.bookVia.name}</p>
          <p className={styles.route}>
            {flight.stops === 0 ? "Nonstop" : `${flight.stops} stop`} · {flight.totalDuration}
          </p>
        </div>
        <div className={styles.priceBox}>
          <span className={styles.price}>{formatMoney(flight.price, flight.currency)}</span>
          {fees > 0 && (
            <span className={styles.fees}>+{formatMoney(fees, flight.currency)} likely fees</span>
          )}
        </div>
      </div>

      <ul className={styles.segments}>
        {flight.segments.map((s, i) => (
          <li key={i}>
            <strong>{s.from} → {s.to}</strong> · {s.airline} {s.flightNo} · {s.duration}
          </li>
        ))}
      </ul>

      {risks.length > 0 && (
        <ul className={styles.risks}>
          {risks.map((r, i) => (
            <li key={i} className={styles[`risk_${r.severity}`]}>⚠ {r.message}</li>
          ))}
        </ul>
      )}

      <a className={styles.book} href={flight.bookVia.url} target="_blank" rel="noopener noreferrer">
        Book direct with {flight.bookVia.name} ↗
      </a>
    </article>
  );
}

export default function SearchExperience() {
  const [form, setForm] = useState({
    origin: "MIA",
    destination: "BER",
    depart: "2026-07-10",
    returnDate: "",
    cabin: "economy",
  });

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);   // { flights, riskMap, explanation }
  const [error, setError] = useState(null);

  function update(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.error) setError(json.error);
      else setData(json);
    } catch {
      setError("Network error. Is the dev server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.row}>
          <label className={styles.field}>
            <span>From</span>
            <input name="origin" value={form.origin} onChange={update} required />
          </label>
          <label className={styles.field}>
            <span>To</span>
            <input name="destination" value={form.destination} onChange={update} required />
          </label>
        </div>
        <div className={styles.row}>
          <label className={styles.field}>
            <span>Depart</span>
            <input type="date" name="depart" value={form.depart} onChange={update} required />
          </label>
          <label className={styles.field}>
            <span>Return (optional)</span>
            <input type="date" name="returnDate" value={form.returnDate} onChange={update} />
          </label>
          <label className={styles.field}>
            <span>Cabin</span>
            <select name="cabin" value={form.cabin} onChange={update}>
              <option value="economy">Economy</option>
              <option value="premium">Premium economy</option>
              <option value="business">Business</option>
            </select>
          </label>
        </div>
        <button className={styles.submit} type="submit" disabled={loading}>
          {loading ? "Comparing…" : "Compare honestly →"}
        </button>
      </form>

      {/* Results render in place, below the form. */}
      {loading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Reading the real options and the fine print…</p>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {data && (
        <section className={styles.results}>
          <div className={styles.explain}>
            <h2 className={styles.explainTitle}>FareWise’s honest read</h2>
            {data.explanation
              .split("\n")
              .filter(Boolean)
              .map((p, i) => (
                <p key={i}>{p}</p>
              ))}
          </div>

          <div className={styles.list}>
            {data.flights.map((f) => (
              <FlightCard key={f.id} flight={f} risks={data.riskMap[f.id] || []} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
```

- [ ] **Step 2: Replace `app/page.js`**

```js
import SearchExperience from "./search-experience";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <main className={styles.page}>
      <p className={styles.eyebrow}>Flight search that tells you the truth</p>
      <h1 className={styles.title}>FareWise</h1>
      <p className={styles.subtitle}>
        We don’t book your flight or hide the catch. We compare the real options,
        explain the trade-offs in plain language, then send you to book direct.
      </p>
      <SearchExperience />
    </main>
  );
}
```

- [ ] **Step 3: Create `app/page.module.css`**

```css
.page {
  max-width: 760px;
  margin: 0 auto;
  padding: 72px 24px 80px;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--accent);
  margin: 0 0 12px;
}

.title {
  font-size: clamp(3rem, 8vw, 5rem);
  margin: 0 0 16px;
}

.subtitle {
  font-size: 1.15rem;
  color: var(--ink-soft);
  max-width: 52ch;
  margin: 0 0 40px;
}

/* Form */
.form {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.row { display: flex; gap: 16px; flex-wrap: wrap; }

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 140px;
}

.field span { font-size: 0.8rem; font-weight: 600; color: var(--ink-soft); }

.field input,
.field select {
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--paper);
  color: var(--ink);
}

.field input:focus,
.field select:focus { outline: 2px solid var(--accent); outline-offset: 1px; }

.submit {
  align-self: flex-start;
  margin-top: 4px;
  padding: 13px 22px;
  border: none;
  border-radius: 10px;
  background: var(--accent);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.submit:hover { background: var(--accent-ink); }
.submit:disabled { opacity: 0.55; cursor: default; }

/* Loading */
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 56px 0;
  color: var(--ink-soft);
}
.spinner {
  width: 34px;
  height: 34px;
  border: 3px solid var(--line);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.error {
  margin-top: 24px;
  background: #fff;
  border: 1px solid var(--danger);
  color: var(--danger);
  padding: 16px;
  border-radius: var(--radius);
}

/* Results */
.results { margin-top: 40px; }

.explain {
  background: var(--card);
  border: 1px solid var(--line);
  border-left: 4px solid var(--accent);
  border-radius: var(--radius);
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: var(--shadow);
}
.explainTitle { font-size: 1.3rem; margin-bottom: 12px; }
.explain p { margin: 0 0 12px; }
.explain p:last-child { margin-bottom: 0; }

.list { display: flex; flex-direction: column; gap: 16px; }
.card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 20px;
  box-shadow: var(--shadow);
}
.cardTop { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.airline { font-weight: 700; margin: 0; }
.route { color: var(--ink-soft); margin: 2px 0 0; font-size: 0.9rem; }
.priceBox { text-align: right; display: flex; flex-direction: column; }
.price { font-size: 1.6rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.fees { font-size: 0.78rem; color: var(--warn); }

.segments { list-style: none; padding: 0; margin: 16px 0; display: flex; flex-direction: column; gap: 6px; }
.segments li { font-size: 0.9rem; color: var(--ink-soft); }
.segments strong { color: var(--ink); }

/* Risk flags */
.risks { list-style: none; padding: 0; margin: 0 0 16px; display: flex; flex-direction: column; gap: 8px; }
.risks li { font-size: 0.88rem; padding: 10px 12px; border-radius: 8px; }
.risk_high { background: #fdecec; color: var(--danger); border: 1px solid #f3c0c0; }
.risk_warn { background: #fdf3e7; color: var(--warn); border: 1px solid #f0d6b0; }
.risk_info { background: #eef6f5; color: var(--accent-ink); border: 1px solid #cfe6e2; }

.book {
  display: inline-block;
  font-weight: 600;
  color: var(--accent);
  text-decoration: none;
  border: 1px solid var(--accent);
  padding: 9px 16px;
  border-radius: 9px;
  transition: background 0.15s ease, color 0.15s ease;
}
.book:hover { background: var(--accent); color: #fff; }
```

- [ ] **Step 4: Verify the full flow**

Run: `npm run dev` (key in `.env.local`), open `http://localhost:3000`, fill the form, click **Compare honestly**.
Expected on the same page, below the form:
1. The button shows "Comparing…" and a spinner + "Reading the real options…" appears.
2. Then "FareWise's honest read" with Claude's plain-language comparison.
3. Four flight cards. `fw_002` shows a **red** self-transfer + tight-connection flag; `fw_004` shows an amber **possible mistake fare** flag; high-fee cards show an info flag.
4. Each card has a working "Book direct …↗" link (placeholder URL opens in a new tab).

- [ ] **Step 5: Commit**

```bash
git add app/search-experience.js app/page.js app/page.module.css
git commit -m "feat: single-page search experience with Claude explanation, cards, risk flags"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Search form (origin, destination, dates, cabin) → Task 6. ✅
- Hardcoded demo flights in the brief's shape → Task 2. ✅
- One server-side API route → demo flights → Claude → comparison (best-for-whom, trade-offs, risk, cabin delta) → Tasks 4 + 5. ✅
- Results display: flights + explanation + "book via" redirect (same page, below form) → Task 6. ✅
- Non-negotiables: live-data-only + no-invention + no-urgency + value-only ranking (system prompt), warn-on-risk (`detectRisks` + cards), key server-only (route + build-grep verify). ✅
- Out-of-scope held: no real API, booking, accounts, alerts, affiliate. ✅

**Placeholder scan:** No TBD/TODO; every code step contains full code; verification steps have exact commands + expected output.

**Type consistency:** `flightResult` shape identical across `demo-flights.js`, `flight-helpers.js`, route, and `search-experience.js`. `detectRisks(flight, allFlights)` signature matches its call in the route. `getExplanation(flights, search, riskMap)` matches its call. Response keys `{ flights, riskMap, explanation }` from the route match the destructuring in `SearchExperience`. Risk severities (`high`/`warn`/`info`) match the CSS classes (`risk_high`/`risk_warn`/`risk_info`). All styles in one `page.module.css` — no orphan `results.module.css` references.
