// app/api/explain/route.js
// The ONLY place Claude is called. Runs on the server — the API key never reaches the browser.
import { getFlights } from "@/lib/flight-source";
import { detectRisks, reconcileVerdict } from "@/lib/flight-helpers";
import { getComparison } from "@/lib/anthropic";

export async function POST(request) {
  try {
    const search = await request.json();

    // Where the flights come from depends on FAREWISE_DATA_SOURCE
    // (demo | sample | live). We only ever reason over THIS data — nothing invented.
    const flights = await getFlights(search);

    // Deterministic honesty flags, computed in code (not left to the AI).
    // The 2nd arg (all flights) is intentional — it lets detectRisks spot a
    // possible mistake fare by comparing each price against the others.
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
