# Progressive-Disclosure Results Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single long explanation block on the results page with three honesty-first layers — a short summary, an at-a-glance card per flight (always-visible verdict tag + always-visible warnings + price + all-in price), and an "Explain" button that reveals the full reasoning — using ONE Claude call that returns both the per-flight verdict tags and the full explanations.

**Architecture:** Claude's free-text output is replaced by a forced tool call (`present_comparison`) whose JSON schema returns `{ summary, flights: [{ id, verdict, tag, explanation }] }`. The card's visible warnings come from deterministic `detectRisks()` (code, never the AI), and the verdict color is clamped server-side against those flags so the AI can only make a card *more* cautious, never hide danger. The Anthropic tool + prompt are extracted into a pure, testable `lib/comparison-prompt.js`; `lib/anthropic.js` keeps only the network call.

**Tech Stack:** Next.js 16 (App Router), React 19, `@anthropic-ai/sdk`, plain CSS Modules, Vitest (new — for unit-testing pure helpers).

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `package.json` | scripts + devDeps | Modify — add `vitest`, `test` script |
| `lib/flight-helpers.js` | pure flight math + honesty detection | Modify — add `allInPrice`, airport-change risk, `reconcileVerdict` |
| `lib/flight-helpers.test.js` | unit tests for the above | Create |
| `lib/comparison-prompt.js` | system prompt + tool schema + user-prompt builder (pure, no SDK) | Create |
| `lib/comparison-prompt.test.js` | unit tests for prompt/tool shape | Create |
| `lib/anthropic.js` | the ONE Claude network call | Modify — slim to `getComparison()` via forced tool |
| `app/api/explain/route.js` | server route: risks + Claude + verdict clamp | Modify — new response shape |
| `app/search-experience.js` | UI: summary + cards + Explain toggle | Modify — restructure |
| `app/page.module.css` | styling | Modify — verdict tag colors, all-in, Explain button, detail panel, summary |

**Final response contract from `/api/explain`:**

```js
{
  flights,                      // demoFlights, unchanged
  riskMap: { fw_001: [ {type, severity, message}, ... ], ... },
  summary: "2-3 sentences…",
  verdicts: {                   // keyed by flight id
    fw_001: { verdict: "good"|"caution"|"high-risk", tag: "…", explanation: "…" },
    ...
  }
}
```

---

## Task 1: Add Vitest

**What/why:** The honesty-critical logic (risk detection, verdict clamping, all-in math) deserves tests so a future edit can't silently break a warning. Vitest is a fast, zero-config test runner that understands the same ESM the rest of the app uses — unlike raw `node --test`, which would choke on these `export` files because `package.json` has no `"type": "module"`.

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest`
Expected: `vitest` appears under `devDependencies`, no errors.

- [ ] **Step 2: Add test scripts**

Edit `package.json` `"scripts"` to add two lines (keep existing scripts):

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

- [ ] **Step 3: Smoke-test the runner**

Run: `npm test`
Expected: Vitest starts and reports `No test files found` (or runs 0 tests) — proves the runner works before any tests exist.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add vitest for unit-testing pure helpers"
```

---

## Task 2: `allInPrice` helper

**Files:**
- Modify: `lib/flight-helpers.js`
- Test: `lib/flight-helpers.test.js`

- [ ] **Step 1: Write the failing test**

Create `lib/flight-helpers.test.js`:

```js
import { describe, it, expect } from "vitest";
import { allInPrice } from "./flight-helpers.js";

describe("allInPrice", () => {
  it("adds the likely add-on fees to the headline price", () => {
    const flight = { price: 420, extraFees: { firstBag: 35, seatSelect: 12, payment: 0 } };
    expect(allInPrice(flight)).toBe(467);
  });

  it("returns the headline price when there are no extra fees", () => {
    const flight = { price: 690, extraFees: {} };
    expect(allInPrice(flight)).toBe(690);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/flight-helpers.test.js`
Expected: FAIL — `allInPrice is not a function` / `is not exported`.

- [ ] **Step 3: Write minimal implementation**

In `lib/flight-helpers.js`, add below `totalExtraFees`:

```js
// Truer cost: headline price plus the checkout-surprise fees.
export function allInPrice(flight) {
  return flight.price + totalExtraFees(flight);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/flight-helpers.test.js`
Expected: PASS (2 passing).

- [ ] **Step 5: Commit**

```bash
git add lib/flight-helpers.js lib/flight-helpers.test.js
git commit -m "feat: add allInPrice helper (price + likely fees)"
```

---

## Task 3: Airport-change risk detection

**What/why:** Spec non-negotiable #6 lists *airport change* as a must-warn risk. Demo flight `fw_002` lands at LGW (Gatwick) but departs the next leg from STN (Stansted) — a separate cross-city transfer `detectRisks()` doesn't currently catch. Detect it whenever a segment's arrival airport differs from the next segment's departure airport.

**Files:**
- Modify: `lib/flight-helpers.js` (the `detectRisks` function)
- Test: `lib/flight-helpers.test.js`

- [ ] **Step 1: Write the failing test**

Append to `lib/flight-helpers.test.js`:

```js
import { detectRisks } from "./flight-helpers.js";

describe("detectRisks — airport change", () => {
  const airportChangeFlight = {
    id: "x", price: 360, currency: "USD", stops: 1, bookingType: "single-ticket",
    protected: true, layover: "2h 00m", extraFees: {},
    segments: [
      { from: "MIA", to: "LGW", airline: "Norse", flightNo: "Z1", duration: "7h" },
      { from: "STN", to: "BER", airline: "Ryanair", flightNo: "F1", duration: "2h" },
    ],
  };

  it("flags a high-severity risk when arrival and next-departure airports differ", () => {
    const risks = detectRisks(airportChangeFlight, [airportChangeFlight]);
    const change = risks.find((r) => r.type === "airport-change");
    expect(change).toBeTruthy();
    expect(change.severity).toBe("high");
    expect(change.message).toContain("LGW");
    expect(change.message).toContain("STN");
  });

  it("does NOT flag an airport change when the connection airport is the same", () => {
    const sameAirport = {
      ...airportChangeFlight,
      segments: [
        { from: "MIA", to: "LIS", airline: "TAP", flightNo: "T1", duration: "7h" },
        { from: "LIS", to: "BER", airline: "TAP", flightNo: "T2", duration: "3h" },
      ],
    };
    const risks = detectRisks(sameAirport, [sameAirport]);
    expect(risks.find((r) => r.type === "airport-change")).toBeFalsy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/flight-helpers.test.js`
Expected: FAIL — no risk with `type === "airport-change"`.

- [ ] **Step 3: Write minimal implementation**

In `lib/flight-helpers.js`, inside `detectRisks`, add this block after the tight-connection check and before the mistake-fare check:

```js
  // Airport change: a leg lands at one airport but the next leg departs from another.
  // That's a separate cross-city transfer the headline itinerary hides.
  const segs = flight.segments || [];
  for (let i = 0; i < segs.length - 1; i++) {
    if (segs[i].to !== segs[i + 1].from) {
      risks.push({
        type: "airport-change",
        severity: "high",
        message: `Airport change: you arrive at ${segs[i].to} but the next flight leaves from ${segs[i + 1].from}. You must get yourself across the city, with your bags, in time.`,
      });
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/flight-helpers.test.js`
Expected: PASS (all tests in file green).

- [ ] **Step 5: Commit**

```bash
git add lib/flight-helpers.js lib/flight-helpers.test.js
git commit -m "feat: detect airport-change risk (arrival != next departure)"
```

---

## Task 4: `reconcileVerdict` — clamp the AI verdict against deterministic flags

**What/why:** Claude returns a `verdict` per flight, but we never trust it to remember the rules. This pure function floors the verdict against our own `detectRisks` output: any `high` flag forces `high-risk`; any `warn` flag forces at least `caution`. The AI can only make a card *more* cautious, never hide danger. `info` flags (e.g. high fees) don't change the verdict — they're already surfaced on the card.

**Files:**
- Modify: `lib/flight-helpers.js`
- Test: `lib/flight-helpers.test.js`

- [ ] **Step 1: Write the failing test**

Append to `lib/flight-helpers.test.js`:

```js
import { reconcileVerdict } from "./flight-helpers.js";

describe("reconcileVerdict", () => {
  it("forces high-risk when any flag is high severity", () => {
    expect(reconcileVerdict("good", [{ severity: "high" }])).toBe("high-risk");
  });

  it("floors a good verdict to caution when a warn flag exists", () => {
    expect(reconcileVerdict("good", [{ severity: "warn" }])).toBe("caution");
  });

  it("leaves a good verdict alone when only info flags exist", () => {
    expect(reconcileVerdict("good", [{ severity: "info" }])).toBe("good");
  });

  it("keeps a stricter AI verdict even with no flags", () => {
    expect(reconcileVerdict("high-risk", [])).toBe("high-risk");
  });

  it("falls back to 'good' for an unknown verdict value", () => {
    expect(reconcileVerdict("amazing", [])).toBe("good");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/flight-helpers.test.js`
Expected: FAIL — `reconcileVerdict is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `lib/flight-helpers.js`:

```js
// Clamp the AI's verdict against the deterministic flags so a model slip
// can only make a card MORE cautious, never hide a real risk.
export function reconcileVerdict(verdict, risks = []) {
  const valid = ["good", "caution", "high-risk"];
  const v = valid.includes(verdict) ? verdict : "good";
  if (risks.some((r) => r.severity === "high")) return "high-risk";
  if (risks.some((r) => r.severity === "warn") && v === "good") return "caution";
  return v;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/flight-helpers.test.js`
Expected: PASS (all green).

- [ ] **Step 5: Commit**

```bash
git add lib/flight-helpers.js lib/flight-helpers.test.js
git commit -m "feat: add reconcileVerdict to clamp AI verdict against risk flags"
```

---

## Task 5: Pure comparison prompt + tool schema

**What/why:** This is the heart of the change. We move from "ask Claude for prose" to "force Claude to fill out a structured form (a tool)." The tool's `input_schema` guarantees we get back a parsed object with one entry per flight, each carrying a `verdict` (locked to 3 values via `enum`), a one-line `tag`, and a full `explanation`. Keeping this file SDK-free makes it unit-testable.

**Files:**
- Create: `lib/comparison-prompt.js`
- Test: `lib/comparison-prompt.test.js`

- [ ] **Step 1: Write the failing test**

Create `lib/comparison-prompt.test.js`:

```js
import { describe, it, expect } from "vitest";
import { COMPARISON_TOOL, buildComparisonPrompt } from "./comparison-prompt.js";

describe("COMPARISON_TOOL", () => {
  it("is named present_comparison", () => {
    expect(COMPARISON_TOOL.name).toBe("present_comparison");
  });

  it("locks verdict to exactly the three allowed values", () => {
    const enumValues =
      COMPARISON_TOOL.input_schema.properties.flights.items.properties.verdict.enum;
    expect(enumValues).toEqual(["good", "caution", "high-risk"]);
  });

  it("requires summary and flights at the top level", () => {
    expect(COMPARISON_TOOL.input_schema.required).toEqual(["summary", "flights"]);
  });

  it("requires id, verdict, tag, explanation on each flight", () => {
    expect(COMPARISON_TOOL.input_schema.properties.flights.items.required).toEqual([
      "id", "verdict", "tag", "explanation",
    ]);
  });
});

describe("buildComparisonPrompt", () => {
  const flights = [{ id: "fw_001" }, { id: "fw_002" }];
  const search = { origin: "MIA", destination: "BER", depart: "2026-07-10", returnDate: "", cabin: "economy" };
  const riskMap = { fw_001: [], fw_002: [] };

  it("lists every flight id so Claude returns one entry per flight", () => {
    const text = buildComparisonPrompt(flights, search, riskMap);
    expect(text).toContain("fw_001");
    expect(text).toContain("fw_002");
    expect(text).toContain("EXACTLY one entry");
  });

  it("includes the search and instructs calling the tool", () => {
    const text = buildComparisonPrompt(flights, search, riskMap);
    expect(text).toContain("MIA -> BER");
    expect(text).toContain("present_comparison");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/comparison-prompt.test.js`
Expected: FAIL — module `./comparison-prompt.js` not found.

- [ ] **Step 3: Write the implementation**

Create `lib/comparison-prompt.js`:

```js
// lib/comparison-prompt.js
// Pure (no SDK): the system prompt, the structured-output tool, and the user-prompt builder.
// Kept SDK-free so it can be unit-tested without an API key.

// The rules FareWise must never break, taught to Claude on every call.
export const SYSTEM_PROMPT = `You are FareWise's honesty layer for flight search.
Your job: explain the trade-offs between the flight options you are given, in plain language, so the traveler can decide for themselves.

Hard rules — never break these:
- Reason ONLY over the flight data provided in this message. Never invent, recall, or estimate any fare, route, schedule, or flight that is not in the data.
- Never state an airline's refund/baggage/change policy as fact. Explain general trade-offs, but flag specific policy details as "check with the airline".
- Never create urgency or scarcity ("book now", "prices rising"). No pressure tactics.
- Do not reorder or favor any option for commercial reasons. Rank only by genuine value to the traveler.
- Warn clearly about risky options: self-transfers / separate tickets, tight connections, airport changes, and suspiciously low (possible mistake) fares.
- When cabinOptions exist, explain the cost delta of upgrading and whether it's worth it.

Be concise, warm, and specific. Use the real numbers from the data.`;

// The structured-output "form" we force Claude to fill out.
// Forcing this tool (tool_choice) means we get back a parsed object, not free text to parse.
export const COMPARISON_TOOL = {
  name: "present_comparison",
  description:
    "Return the honest comparison: a short summary plus, for every flight, a one-line verdict tag, a verdict level, and the full plain-language explanation.",
  input_schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description:
          "2-3 sentences. Name the best-balance pick, the easiest (lowest-stress) pick, and which option(s) to be cautious about. Use airline names and the real prices from the data.",
      },
      flights: {
        type: "array",
        description: "One entry per flight in the data. Use the exact id from the data.",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "The flight's id, e.g. fw_001." },
            verdict: {
              type: "string",
              enum: ["good", "caution", "high-risk"],
              description:
                "good = solid/best value. caution = a real trade-off (tight-ish layover, notable fees). high-risk = self-transfer with no protection, airport change, sub-60-minute connection, or suspected mistake fare. It MUST agree with the provided risk flags: any 'high' severity flag => 'high-risk'; any 'warn' flag => at least 'caution'.",
            },
            tag: {
              type: "string",
              description:
                "ONE line, about 12 words max — the honest verdict a traveler reads at a glance. No markdown.",
            },
            explanation: {
              type: "string",
              description:
                "Full plain-language reasoning: who it's best for, the trade-offs, the catch stated plainly, and the cabin-upgrade delta where cabinOptions exist. A few short sentences.",
            },
          },
          required: ["id", "verdict", "tag", "explanation"],
        },
      },
    },
    required: ["summary", "flights"],
  },
};

// Build the user message: the search + the flights as JSON + precomputed risk flags.
export function buildComparisonPrompt(flights, search, riskMap) {
  const ids = flights.map((f) => f.id).join(", ");
  return `Traveler searched: ${search.origin} -> ${search.destination}, departing ${search.depart}${
    search.returnDate ? ", returning " + search.returnDate : ""
  }, cabin: ${search.cabin}.

Here are the ONLY flight options to consider (JSON):
${JSON.stringify(flights, null, 2)}

Deterministic risk flags we already detected (treat as ground truth, weave into your explanation, and let them drive the verdict):
${JSON.stringify(riskMap, null, 2)}

Call the present_comparison tool. Requirements:
- The flights array must contain EXACTLY one entry for each of these ids: ${ids}. Use each id verbatim.
- summary: 2-3 sentences naming the best-balance pick, the easiest (lowest-stress) pick, and which option(s) to be cautious about. Use airline names and the real prices.
- For each flight: a one-line verdict tag, a verdict level that agrees with the risk flags above, and a full plain-language explanation including the cabin-upgrade delta where cabinOptions exist.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/comparison-prompt.test.js`
Expected: PASS (all green).

- [ ] **Step 5: Commit**

```bash
git add lib/comparison-prompt.js lib/comparison-prompt.test.js
git commit -m "feat: add pure comparison prompt + present_comparison tool schema"
```

---

## Task 6: Slim `lib/anthropic.js` to one forced-tool call

**What/why:** Replace `getExplanation` (free text) with `getComparison`, which forces the `present_comparison` tool and returns the already-parsed object from the `tool_use` block. The system prompt + tool now live in `comparison-prompt.js`; this file keeps only the network call and the SDK client. Not unit-tested (it requires a live API key) — verified manually in Task 9.

**Files:**
- Modify: `lib/anthropic.js`

- [ ] **Step 1: Replace the file contents**

Overwrite `lib/anthropic.js` with:

```js
// lib/anthropic.js
// Server-only helper that talks to Claude. NEVER import this into a client component.
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, COMPARISON_TOOL, buildComparisonPrompt } from "./comparison-prompt.js";

// ── MODEL SETTING ─────────────────────────────────────────────
// Change the model here (one-line switch). Options, least -> most capable:
//   "claude-haiku-4-5"    <- fastest + cheapest
//   "claude-sonnet-4-6"   <- currently using (strong reasoning, still fast)
//   "claude-opus-4-8"     <- most capable, slower + pricier
const MODEL = "claude-sonnet-4-6";
// ──────────────────────────────────────────────────────────────

// One client, reused. Reads the key from .env.local (server-side only).
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ONE call: returns the summary + per-flight verdict tags + per-flight explanations.
// We force the present_comparison tool so the reply is structured data, not free text.
export async function getComparison(flights, search, riskMap) {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2048, // room for a summary + a tag + an explanation per flight
    // cache_control caches the static system prompt so repeat searches are cheaper/faster.
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    tools: [COMPARISON_TOOL],
    tool_choice: { type: "tool", name: "present_comparison" }, // force the tool
    messages: [{ role: "user", content: buildComparisonPrompt(flights, search, riskMap) }],
  });

  // With a forced tool, Claude replies with a tool_use block whose .input is already
  // a parsed JS object matching the schema — no JSON.parse, no code fences.
  const block = msg.content.find((b) => b.type === "tool_use");
  if (!block) throw new Error("Claude did not return the present_comparison tool call.");
  return block.input; // { summary, flights: [{ id, verdict, tag, explanation }] }
}
```

- [ ] **Step 2: Verify nothing else imports the removed function**

Run: `npx eslint lib/anthropic.js`
Expected: no errors. (The route is updated in Task 7; `getExplanation`/`buildExplainPrompt` are intentionally gone.)

- [ ] **Step 3: Commit**

```bash
git add lib/anthropic.js
git commit -m "refactor: replace getExplanation with structured getComparison tool call"
```

---

## Task 7: Update the API route to clamp verdicts and return the new shape

**Files:**
- Modify: `app/api/explain/route.js`

- [ ] **Step 1: Replace the file contents**

Overwrite `app/api/explain/route.js` with:

```js
// app/api/explain/route.js
// The ONLY place Claude is called. Runs on the server — the API key never reaches the browser.
import { demoFlights } from "@/lib/demo-flights";
import { detectRisks, reconcileVerdict } from "@/lib/flight-helpers";
import { getComparison } from "@/lib/anthropic";

export async function POST(request) {
  try {
    const search = await request.json();

    // Phase 1: data is the hardcoded demo set (no real flight API yet).
    // We only ever reason over THIS data — nothing invented.
    const flights = demoFlights;

    // Deterministic honesty flags, computed in code (not left to the AI).
    const riskMap = {};
    for (const f of flights) riskMap[f.id] = detectRisks(f, flights);

    // ONE Claude call: summary + per-flight verdict tags + explanations.
    const result = await getComparison(flights, search, riskMap);

    // Map Claude's per-flight output by id, and clamp each verdict against OUR flags
    // so a model slip can only make a card more cautious, never hide a risk.
    const verdicts = {};
    for (const item of result.flights || []) {
      verdicts[item.id] = {
        verdict: reconcileVerdict(item.verdict, riskMap[item.id] || []),
        tag: item.tag,
        explanation: item.explanation,
      };
    }

    return Response.json({ flights, riskMap, summary: result.summary, verdicts });
  } catch (err) {
    console.error("explain route error:", err);
    return Response.json(
      { error: "Could not generate an explanation. Check the server logs and your ANTHROPIC_API_KEY." },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Lint the route**

Run: `npx eslint app/api/explain/route.js`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/explain/route.js
git commit -m "feat: route returns summary + clamped per-flight verdicts"
```

---

## Task 8: Restructure the UI into three progressive-disclosure layers

**What/why:** Replace the one big explanation block with: (1) a summary block, (2) a card per flight showing airline, route+stops+duration, the colored verdict tag, price, all-in price, and the always-visible warnings, and (3) an "Explain" button that toggles the full explanation + the segment breakdown. The warnings render whether or not the card is expanded — only the longer reasoning hides behind Explain (non-negotiable #6).

**Files:**
- Modify: `app/search-experience.js`

- [ ] **Step 1: Update the imports**

Change line 3 of `app/search-experience.js` from:

```js
import { formatMoney, totalExtraFees } from "@/lib/flight-helpers";
```

to:

```js
import { formatMoney, totalExtraFees, allInPrice } from "@/lib/flight-helpers";
```

- [ ] **Step 2: Replace the `FlightCard` component**

Replace the entire `FlightCard` function (lines 6–47) with:

```jsx
// Maps a verdict value to its CSS-module color class.
const VERDICT_CLASS = {
  good: "verdictGood",
  caution: "verdictCaution",
  "high-risk": "verdictHighRisk",
};

// One flight result card.
// At a glance: airline, route, verdict tag, price, all-in price, and ALWAYS-visible warnings.
// Behind "Explain": the full reasoning (incl. cabin-upgrade delta) and the segment breakdown.
function FlightCard({ flight, risks, verdict }) {
  const [open, setOpen] = useState(false);
  const fees = totalExtraFees(flight);
  const allIn = allInPrice(flight);
  const level = verdict?.verdict || "good";

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
          <span className={styles.allIn}>
            {fees > 0 ? `~${formatMoney(allIn, flight.currency)} all-in` : "no add-on fees"}
          </span>
        </div>
      </div>

      {/* Layer 2: the one-line honest verdict, color-coded. */}
      {verdict?.tag && (
        <p className={`${styles.verdict} ${styles[VERDICT_CLASS[level]]}`}>{verdict.tag}</p>
      )}

      {/* Warnings ALWAYS show — even collapsed. Deterministic, from code, not the AI. */}
      {risks.length > 0 && (
        <ul className={styles.risks}>
          {risks.map((r, i) => (
            <li key={i} className={styles[`risk_${r.severity}`]}>⚠ {r.message}</li>
          ))}
        </ul>
      )}

      <div className={styles.cardActions}>
        <button
          type="button"
          className={styles.explainBtn}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          {open ? "Hide details" : "Explain"}
        </button>
        <a className={styles.book} href={flight.bookVia.url} target="_blank" rel="noopener noreferrer">
          Book direct ↗
        </a>
      </div>

      {/* Layer 3: full reasoning + segment detail, revealed on demand. */}
      {open && (
        <div className={styles.detail}>
          <ul className={styles.segments}>
            {flight.segments.map((s, i) => (
              <li key={i}>
                <strong>{s.from} → {s.to}</strong> · {s.airline} {s.flightNo} · {s.duration}
              </li>
            ))}
          </ul>
          {verdict?.explanation
            ? verdict.explanation
                .split("\n")
                .filter(Boolean)
                .map((p, i) => <p key={i}>{p}</p>)
            : <p>No further detail available.</p>}
        </div>
      )}
    </article>
  );
}
```

- [ ] **Step 3: Replace the results section**

Replace the results block (the `{data && ( … )}` JSX, originally lines 133–151) with:

```jsx
      {data && (
        <section className={styles.results}>
          {/* Layer 1: the short summary. */}
          <div className={styles.summary}>
            <h2 className={styles.summaryTitle}>FareWise&apos;s honest read</h2>
            <p>{data.summary}</p>
          </div>

          {/* Layer 2 + 3: one card per flight. */}
          <div className={styles.list}>
            {data.flights.map((f) => (
              <FlightCard
                key={f.id}
                flight={f}
                risks={data.riskMap[f.id] || []}
                verdict={data.verdicts[f.id]}
              />
            ))}
          </div>
        </section>
      )}
```

- [ ] **Step 4: Lint**

Run: `npx eslint app/search-experience.js`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/search-experience.js
git commit -m "feat: three-layer progressive-disclosure results (summary, cards, explain)"
```

---

## Task 9: Style the new layers

**What/why:** Add styles for the verdict tag (3 colors, reusing existing `--safe`/`--warn`/`--danger` tokens), the all-in price line, the Explain button, the detail panel, and the summary block. Replace the now-unused `.explain`/`.explainTitle` rules with `.summary`/`.summaryTitle`.

**Files:**
- Modify: `app/page.module.css`

- [ ] **Step 1: Replace the old `.explain` rules with summary styles**

In `app/page.module.css`, replace these lines (originally 111–122):

```css
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
```

with:

```css
.summary {
  background: var(--card);
  border: 1px solid var(--line);
  border-left: 4px solid var(--accent);
  border-radius: var(--radius);
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: var(--shadow);
}
.summaryTitle { font-size: 1.3rem; margin-bottom: 12px; }
.summary p { margin: 0; }
```

- [ ] **Step 2: Add the verdict, all-in, actions, and detail styles**

Append to the end of `app/page.module.css`:

```css
/* All-in price line under the headline price */
.allIn { font-size: 0.78rem; color: var(--ink-soft); font-variant-numeric: tabular-nums; }

/* Layer 2: one-line verdict tag, color-coded by level */
.verdict {
  display: inline-block;
  font-weight: 600;
  font-size: 0.92rem;
  line-height: 1.4;
  padding: 8px 12px;
  border-radius: 8px;
  margin: 0 0 14px;
}
.verdictGood { background: #ecf6ef; color: var(--safe); border: 1px solid #c5e3cf; }
.verdictCaution { background: #fdf3e7; color: var(--warn); border: 1px solid #f0d6b0; }
.verdictHighRisk { background: #fdecec; color: var(--danger); border: 1px solid #f3c0c0; }

/* Card action row: Explain toggle + book link */
.cardActions { display: flex; gap: 12px; align-items: center; }

.explainBtn {
  font-weight: 600;
  color: var(--ink);
  background: var(--paper);
  border: 1px solid var(--line);
  padding: 9px 16px;
  border-radius: 9px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.explainBtn:hover { background: #efece3; border-color: var(--ink-soft); }
.explainBtn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

/* Layer 3: revealed detail panel */
.detail {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}
.detail p { margin: 0 0 12px; }
.detail p:last-child { margin-bottom: 0; }
```

- [ ] **Step 3: Adjust segment margin inside the detail panel**

The `.segments` rule has `margin: 16px 0;`. Inside the detail panel its top margin is redundant. Change the `.segments` rule (originally line 139) from:

```css
.segments { list-style: none; padding: 0; margin: 16px 0; display: flex; flex-direction: column; gap: 6px; }
```

to:

```css
.segments { list-style: none; padding: 0; margin: 0 0 16px; display: flex; flex-direction: column; gap: 6px; }
```

- [ ] **Step 4: Commit**

```bash
git add app/page.module.css
git commit -m "style: verdict tag colors, all-in price, explain button, detail panel"
```

---

## Task 10: Full-suite + manual end-to-end verification

**What/why:** Tests prove the pure logic; the Claude call and UI need eyes. Verify the real flow and the honesty guarantees.

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all tests in `lib/flight-helpers.test.js` and `lib/comparison-prompt.test.js` PASS.

- [ ] **Step 2: Lint the whole project**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Confirm the API key is present for a live call**

Confirm `.env.local` contains `ANTHROPIC_API_KEY=...`. (If missing, the route returns the friendly error and the UI shows it — that's expected, not a bug.)

- [ ] **Step 4: Run the app and exercise the flow**

Run: `npm run dev`
Then open `http://localhost:3000`, leave the default MIA → BER search, and click **Compare honestly**. Verify against this checklist:

- [ ] A short summary appears at the top naming a best-balance pick, an easiest pick, and what to be cautious about.
- [ ] Each flight is a card showing airline, route + stops + duration, a colored one-line verdict tag, the price, and the all-in price (e.g. TAP shows `~$467 all-in`).
- [ ] **fw_002 (Norse self-transfer, LGW→STN)** shows its warnings — self-transfer no-protection AND airport-change — **while collapsed**, and its verdict tag is red (high-risk).
- [ ] **fw_004 (Condor, $188)** shows the possible-mistake-fare warning while collapsed; verdict is amber (caution).
- [ ] Clicking **Explain** on a card reveals the full reasoning + the segment breakdown; clicking again hides it. Warnings stay visible either way.
- [ ] An Explain panel that has cabinOptions (fw_001, fw_003) mentions the business-class upgrade delta.
- [ ] "Book direct ↗" still links out.

- [ ] **Step 5: Final commit (only if any verification fix was needed)**

```bash
git add -A
git commit -m "fix: address issues found during end-to-end verification"
```

---

## Notes for the implementer

- **Honesty invariant:** the card's `risks` (warnings) come from `data.riskMap` (deterministic `detectRisks`), never from Claude. Never move warning rendering behind the Explain toggle.
- **Verdict trust:** the displayed verdict is always the *clamped* value from `reconcileVerdict` (done in the route), never Claude's raw value.
- **Money never from the AI:** `price` and the all-in figure are computed in code (`allInPrice`). Claude only narrates them.
- **One API call:** the whole results page is powered by a single `getComparison` call — no second request for tags vs. explanations.
```
