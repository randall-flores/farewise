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
4. **Phase 4 — Honesty features**: catch-warnings, total-cost-upfront, mistake-fare flagging.
5. **Phase 5 — Prove it**: book a real trip, compare the decision against Google Flights / Skyscanner, document the outcome.

---

## Success metric

The owner can use FareWise to make a genuinely better, better-informed flight decision than the big apps give them — and trust it enough to recommend to friends and family. "Better" means smarter decisions and no hidden costs, **not** magically lower headline fares (we draw from the same fare data as everyone else).
