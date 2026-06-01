// app/api/explain/route.js
// The ONLY place Claude is called. Runs on the server — the API key never reaches the browser.
import { getFlights } from "@/lib/flight-source";
import { detectRisks, reconcileVerdict } from "@/lib/flight-helpers";
import { getComparison } from "@/lib/anthropic";

export async function POST(request) {
  const search = await request.json();

  // 1) Get the flights. Source is SerpApi in production (FAREWISE_DATA_SOURCE).
  // We only ever reason over THIS data — nothing invented. On ANY failure or an
  // empty result we DO NOT fall back to demo/fake data: we return an honest
  // down-state. FareWise would rather show nothing than fares it can't verify.
  let flights;
  let priceInsights = null;
  let source = "serpapi";
  try {
    ({ flights, priceInsights, source } = await getFlights(search));
  } catch (err) {
    console.error("flight source error:", err);
    return Response.json(
      {
        error:
          "We couldn't pull up verified fares for this search right now. FareWise won't show prices it can't stand behind — please try again in a moment.",
      },
      { status: 502 }
    );
  }

  // 2) Explain. A failure here is different: we HAVE real flights, the AI layer
  // just didn't respond. Say so honestly, separately from a data outage.
  try {
    // Deterministic honesty flags, computed in code (not left to the AI).
    // The 2nd arg (all flights) is intentional — it lets detectRisks spot a
    // possible mistake fare by comparing each price against the others.
    const riskMap = {};
    for (const f of flights) riskMap[f.id] = detectRisks(f, flights);

    // ONE Claude call: summary + per-flight verdict tags + explanations.
    // priceInsights (per-search, real or null) lets Claude ground its read.
    const result = await getComparison(flights, search, riskMap, priceInsights);

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

    // Echo the searched context so the client can request booking options later
    // with the EXACT search that produced these results (not a since-edited form).
    const searchContext = {
      origin: search.origin,
      destination: search.destination,
      depart: search.depart,
    };
    return Response.json({
      flights,
      riskMap,
      summary: result.summary,
      verdicts,
      priceInsights,
      source,
      search: searchContext,
    });
  } catch (err) {
    console.error("explain route error:", err);
    return Response.json(
      { error: "We found flights but couldn't generate the plain-language read just now. Try again in a moment." },
      { status: 500 }
    );
  }
}
