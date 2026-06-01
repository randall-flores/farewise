# FareWise — Project Brief

> This file gives Claude Code the context to build FareWise correctly.
> Read it before making changes. When in doubt, favor the rules in
> "Non-negotiables" over speed or cleverness.

---

## What FareWise is

FareWise is an AI-powered flight search tool whose differentiator is **honesty**, not lower prices.

**One-line thesis:** _Be the flight search that tells you the truth about the cheap option — so the user can decide, not be nudged._

It does **not** book flights. It searches, compares, explains the trade-offs in plain language, and then **redirects the user to book directly** with the airline or a booking partner (the same model as Google Flights). We never become the merchant of record — that avoids the liability and broken-refund problems that plague apps like Kiwi.com.

Claude's role inside the product is to **reason over live flight data and explain trade-offs** — not to list results and not to invent anything.

---

## Non-negotiables (design rules, not preferences)

Each rule exists because a competitor's failure proved it matters. Breaking any of these breaks the only thing FareWise sells: trust.

1. **Live data only.** Claude reasons over the flight data actually returned by the data source for the current search. It must never recall, estimate, or invent a fare, route, or schedule. (In Phase 1, "live data" is the demo dataset — Claude still only reasons over what it's given, never makes up extra flights.)
2. **Never state an airline policy as fact** unless it came from the data source and is current. Explain trade-offs freely; do not assert refund rules, baggage rules, etc. as fact from memory.
3. **Money never shapes the ranking.** A referral/affiliate fee is acceptable, but it must never reorder results or trigger urgency. Results are ranked by genuine value to the user.
4. **No fake scarcity or urgency.** No "prices likely to rise" pressure tactics. If timing is mentioned, it must come from data, with uncertainty stated honestly.
5. **Promise only what we control.** We can say "we don't inflate prices based on your search history." We must be explicit that the airline's final price at booking can still vary by market/currency — that part is outside our control.
6. **Warn loudly on risky options.** Self-transfers, hidden-city tickets, tight connections, and suspiciously low ("possible mistake fare") prices must have their risk spelled out in plain language — never sold silently.

---

## Tech stack

- **Framework:** Next.js (App Router) deployed on Vercel
- **Styling:** plain CSS for now (clear over clever; Tailwind can come later if wanted)
- **AI:** Claude via the official `@anthropic-ai/sdk` npm package
- **Critical security rule:** Claude is called **only from a server-side API route**, never from the browser/client. The Anthropic API key lives in `.env.local` (git-ignored) and is read as an environment variable. The same applies to any flight-data API key added later. A key must never appear in client code or be committed to the repo.

---

## Data sources (current implementation)

The whole app reasons over the normalized `flightResult` shape (below) and does not care where data came from. `FAREWISE_DATA_SOURCE` selects the source in `lib/flight-source.js`:

- **`serpapi` (default, the only REAL source).** SerpApi's Google Flights engine, called server-side only (`lib/serpapi.js`, `SERPAPI_KEY` is secret), normalized by `lib/normalize-serpapi.js`. **One-way only** for now (`type=2`); `currency=USD`, `hl=en`, `gl=us`. This is the production default.
- **`demo` (LOCAL DEVELOPMENT ONLY).** Hand-written flights in `lib/demo-flights.js`, for building the UI. **Hard-blocked in production** (`getFlights` throws when `NODE_ENV==="production"`) so we can never serve data we can't stand behind.

Rules that come straight from "honesty is the product":

- **Duffel was removed entirely** (flight search *and* airport autocomplete). It was sandbox/test data and must never be a fallback.
- **No fake fallback.** On any SerpApi failure *or* an empty result, we do **not** fall back to demo/fake data. The `/api/explain` route returns an honest down-state and the UI shows a brief on-brand message — we'd rather show nothing than prices we can't verify.
- **Booking/seller links are NOT fetched on the results page.** `bookVia.url` stays `null`; the SerpApi `departure_token` is kept in `bookVia.token` for a later lazy fetch (on card expand / book click). The placeholder spot is marked in `search-experience.js` and `normalize-serpapi.js`.
- **Unknowns are never invented.** SerpApi search gives no à-la-carte fees, baggage, refund rules, or other-cabin prices, so the normalizer marks them unknown (`feesKnown:false`, `baggage:{carryOn:null,checked:null}`, `refundable:null`, single-cabin `cabinOptions`).
- **Airport autocomplete is offline/local.** A bundled dataset (`lib/airports.json`) filtered client-side by `lib/airport-search.js`. No API call per keystroke, no SerpApi quota burned on typing. Extend coverage by appending to `airports.json`.

**Not built yet (don't build ahead):** round-trip (the `return_date` + second `departure_token` call), and the lazy booking-link fetch.

---

## Current phase: Phase 1 — Demo prototype

**Goal of this phase:** prove that Claude's plain-language explanation layer is genuinely useful. Nothing else matters yet.

**Scope — build exactly this, no more:**

- A simple search form (origin, destination, dates, cabin class)
- A small set of **hardcoded demo flight results** (see data shape below) — fake flights, written by hand, saved in a file. No real flight API in this phase.
- One server-side API route that sends the demo results to Claude and gets back a plain-language comparison: which option is best for whom, the trade-offs, any risk/catch, and the cabin-upgrade delta.
- A results page that shows the flights plus Claude's explanation, with a "book via" redirect link (can be a placeholder URL in Phase 1).

**Explicitly out of scope for Phase 1:** real flight API, live prices, booking flow, user accounts, price alerts, affiliate links. Those are later phases.

---

## Core data shape

Every flight result — demo now, real later — is normalized into this shape so the rest of the app never cares where the data came from. The three blocks that make it _FareWise_ are the honesty layer, `extraFees`, and `cabinOptions`.

```js
const flightResult = {
  id: "fw_001",
  price: 420, // price for the cabin the user searched
  currency: "USD",
  cabin: "economy",

  // the journey
  totalDuration: "11h 30m",
  stops: 1,
  segments: [
    {
      from: "MIA",
      to: "LIS",
      airline: "TAP",
      flightNo: "TP202",
      depart: "2026-07-10T18:40",
      arrive: "2026-07-11T07:10",
      duration: "7h 30m",
    },
    {
      from: "LIS",
      to: "BER",
      airline: "TAP",
      flightNo: "TP534",
      depart: "2026-07-11T09:00",
      arrive: "2026-07-11T13:10",
      duration: "3h 10m",
    },
  ],

  // honesty layer — powers "this is cheaper because..."
  bookingType: "single-ticket", // or "self-transfer" (separate tickets = risky)
  protected: true, // if self-transfer, is the user covered on a miss?
  layover: "1h 50m", // is the connection realistic?
  baggage: { carryOn: true, checked: 0 },
  extraFees: { firstBag: 35, seatSelect: 12, payment: 0 }, // checkout surprises, surfaced
  refundable: false,

  // upgrade transparency
  cabinOptions: [
    { cabin: "economy", price: 420 },
    {
      cabin: "business",
      price: 1310,
      perks: ["lie-flat", "lounge", "2 checked bags"],
    },
  ],

  // redirect-to-book (we never book in-app)
  bookVia: {
    name: "TAP Air Portugal",
    url: "https://placeholder-affiliate-link",
  },
};
```

---

## How to work with the developer (project owner)

- Beginner coder, learning by doing. Knows HTML/CSS and some Next.js. Works in VS Code, GitHub, Vercel.
- **Explain new concepts, tools, or libraries** when introducing them — what it is and why we're using it.
- **Clear over clever.** Readable code a learner can follow beats elegant code they can't.
- **Don't make large unprompted changes.** Propose the approach, check before big rewrites, let the owner drive when they want to learn a piece themselves.
- Proactively suggest genuinely useful tools, npm packages, or VS Code extensions — but don't over-engineer Phase 1.

---

## The roadmap (for context — don't build ahead of the current phase)

1. **Phase 1 — Demo prototype** _(current)_: form + hardcoded flights + Claude explanation. Free.
2. **Phase 2 — Real data, free tier**: swap demo objects for live results (e.g. Sky Scrapper API on RapidAPI, free tier), normalized into the shape above.
3. **Phase 3 — Make it usable**: upgrade to a paid data tier (~$10–30/mo) for volume + commercial rights + live data; add cabin selection + upgrade comparison; add affiliate redirect links (e.g. Travelpayouts).
   - _(Phase 2/3)_ Calendar price overview (like Google Flights) — show fares across a range of dates so users see cheap/expensive days at a glance. Requires live flight data; not possible with demo data, so build this once real data is wired in.
4. **Phase 4 — Honesty features**: catch-warnings, total-cost-upfront, mistake-fare flagging.
5. **Phase 5 — Prove it**: book a real trip, compare the decision against Google Flights / Skyscanner, document the outcome.

---

## Voice & language rules (how every explanation must sound)

FareWise's explanations are the product. They must sound like a sharp, honest operator who respects the user's time — not a travel blogger and not an AI essay. Two rules govern everything:

### Rule 1 — Transactional

State the fact, then why it matters, then stop. No mood words, no padding, no hedging. One idea per line. The user is booking a flight, not reading an article — they want the decision made fast.

- Cut adjectives that set a mood ("relaxed," "comfortable," "smooth journey").
- Prefer fact + consequence: "One ticket, so if the first flight is late, TAP rebooks you."
- Use → and short fragments for cost math: "Bag +$35, seat +$12 → ~$467 total."

### Rule 2 — Plain language (no jargon)

The test for every word: would someone who flies twice a year understand it instantly? If not, swap it. Never make the user feel they need insider knowledge — that breaks the trust the whole product is built on.

Banned word → use instead:

- "leg" / "first leg" → "flight" / "first flight"
- "layover" → "wait" or "stop" ("1h 50m wait between flights")
- "self-transfer" → "separate tickets"
- "nonstop" / "direct" → "no stops" / "one flight, straight there"
- "all-in" → "total"
- "reprices" / "fare adjusts" → "until the price is confirmed"
- "virtual interlining," "hidden city," etc. → explain in plain words, never name the jargon

### The one exception — risk warnings stay full sentences

Transactional does NOT mean cryptic. Where a user must actually UNDERSTAND a risk, clarity beats brevity. Write the warning as a plain, blunt, complete sentence — never shorthand. This is the moment that matters most.

Good: "High risk: these are two separate tickets, and you'd have to switch airports (London Gatwick → Stansted, about 60 miles) in 1h 10m. If you miss the second flight, you lose that ticket and pay again. Skip it."

### Before / after reference

Verdict line —

- ❌ "Single-ticket itinerary with carrier liability on the first leg."
- ✅ "One ticket — if your first flight is late, TAP puts you on the next one."

Detail —

- ❌ "At $420 this connects through Lisbon with a comfortable 1h 50m layover on a single ticket, which is the key thing — TAP is responsible for getting you onward if the first leg is late."
- ✅ "$420, one stop in Lisbon (1h 50m wait). It's one ticket, so if the first flight is delayed and you miss the connection, TAP rebooks you — their problem, not yours. Bag not included: +$35, seat +$12 → ~$467 total."

---

## Success metric

The owner can use FareWise to make a genuinely better, better-informed flight decision than the big apps give them — and trust it enough to recommend to friends and family. "Better" means smarter decisions and no hidden costs, **not** magically lower headline fares (we draw from the same fare data as everyone else).
