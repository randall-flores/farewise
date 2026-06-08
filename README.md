# FareWise

Honest flight search that explains the catch in plain language, then sends you to book direct.

## Overview

Most flight tools list fares and let you discover the trade-offs at checkout: separate tickets with no protection, a 45-minute connection, a price that looks too good because it is a mistake. FareWise searches the same live fare data as everyone else, then uses Claude to explain, in plain language, which option fits whom and where the risk hides. It never books in-app and never becomes the merchant of record; like Google Flights, it compares and then redirects you to the airline or a booking partner.

## Tech Stack

- **Next.js 16** (App Router, Turbopack) and **React 19**
- **JavaScript** (no TypeScript), **plain CSS** with CSS Modules and design tokens
- **Anthropic Claude** via the official `@anthropic-ai/sdk` (server-side only)
- **SerpApi** Google Flights engine for live fares (server-side only)
- **next/font** for the type system (Fraunces, Hanken Grotesk, JetBrains Mono)
- **Vitest** for unit tests
- Deployed on **Vercel**

## Key Features

- Live flight search: one-way and round-trip, cabin class, and a full passenger selector (adults, children, infants in seat and on lap).
- The "Honest Read": a Claude-written, plain-language comparison of every option, with the single deciding factor per flight.
- Deterministic risk warnings surfaced on every card: separate tickets, tight connections, airport changes between flights, and possible mistake fares.
- Total-cost honesty: headline fare plus the checkout surprises (bags, seat selection) where the data provides them, and an explicit "fees not listed" when it does not.
- Boarding-pass result cards with a perforated price stub, a green tag on the single cheapest fare, and a split-flap departure board for the route.
- Lazy "How to book": real seller options (direct vs third party) are fetched only when a card is expanded, then posted to the seller's checkout.
- Offline airport and city autocomplete, so typing never burns an API quota.
- Honest empty and error states: a calm "no flights for these dates" versus a clear failure message, and never a fabricated fare.

## Tech Highlights

- **Structured output, not parsed text.** The Honest Read comes from a single Claude call that forces a `present_comparison` tool, so the model returns a typed object (summary plus a verdict, one-line tag, and explanation per flight) instead of free text that has to be parsed. The static system prompt is cached so repeat searches are cheaper and faster.
- **Prompt design as the product.** The system prompt encodes FareWise's voice and hard rules: reason only over the supplied data, never invent a fare or state a policy as fact, warn loudly on risk, and write plain prose with no jargon and no em dashes. A deterministic risk pass in code runs first and clamps the model's verdict, so a model slip can only make a card more cautious, never hide a real risk.
- **Live round-trip fares from SerpApi.** Round trips use a two-call flow against the Google Flights engine with `deep_search` enabled, because the shallow default returns empty for routes the browser actually shows. Every response is normalized into one `flightResult` shape, with unknowns (baggage, refundability, ticket type) marked unknown rather than guessed.
- **Split-flap board UI.** The hero route renders as a real departure board, and the same flap mechanic is reused on results: key times flap into place and prices count up on load, all with a `prefers-reduced-motion` fallback that shows the final values instantly.

## Running Locally

Requires Node.js 18+ and npm.

```bash
# 1. Install dependencies
npm install

# 2. Create .env.local in the project root (git-ignored, never committed)
#    Use your own keys; the values below are placeholders.
cat > .env.local <<'EOF'
ANTHROPIC_API_KEY=your-anthropic-api-key
SERPAPI_KEY=your-serpapi-key
# Data source: "serpapi" (live, default) or "demo" (local sample data, dev only)
FAREWISE_DATA_SOURCE=serpapi
EOF

# 3. Start the dev server
npm run dev
```

Open http://localhost:3000.

Other scripts:

```bash
npm run build   # production build
npm run start   # serve the production build
npm run lint    # ESLint
npm test        # run the Vitest suite
```

Both keys are read server-side only and must never appear in client code. `FAREWISE_DATA_SOURCE=demo` uses hand-written sample flights for UI work and is hard-blocked in production builds.

## Links

- **Live demo:** _coming soon_ (TODO: add URL)
- **Case study:** https://randall-portfolio-six.vercel.app/work/farewise
