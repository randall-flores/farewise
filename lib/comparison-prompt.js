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
