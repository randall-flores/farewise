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
