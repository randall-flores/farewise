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

// Fail loudly and clearly if the key is missing, instead of a cryptic SDK error later.
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env.local (see CLAUDE.md).");
}

// One client, reused. Reads the key from .env.local (server-side only).
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ONE call: returns the summary + per-flight verdict tags + per-flight explanations.
// We force the present_comparison tool so the reply is structured data, not free text.
export async function getComparison(flights, search, riskMap, priceInsights = null) {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2048, // room for a summary + a tag + an explanation per flight
    // cache_control caches the static system prompt so repeat searches are cheaper/faster.
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    tools: [COMPARISON_TOOL],
    tool_choice: { type: "tool", name: "present_comparison" }, // force the tool
    messages: [{ role: "user", content: buildComparisonPrompt(flights, search, riskMap, priceInsights) }],
  });

  // With a forced tool, Claude replies with a tool_use block whose .input is already
  // a parsed JS object matching the schema — no JSON.parse, no code fences.
  const block = msg.content.find((b) => b.type === "tool_use");
  if (!block) throw new Error("Claude did not return the present_comparison tool call.");
  return block.input; // { summary, flights: [{ id, verdict, tag, explanation }] }
}
