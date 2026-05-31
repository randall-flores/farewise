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
