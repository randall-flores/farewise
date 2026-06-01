// lib/flight-source.js
// Single place that decides WHERE flight data comes from. Set with FAREWISE_DATA_SOURCE:
//
//   "serpapi" (default) — real, verifiable Google Flights data via SerpApi.
//                         The ONLY real source. Production default.
//   "demo"             — hand-written demoFlights. LOCAL DEVELOPMENT ONLY, for
//                         building the UI. Hard-blocked in production so we can
//                         never serve data we can't stand behind.
//
// There is deliberately NO fallback to demo/fake data when SerpApi fails or
// returns nothing. FareWise would rather show nothing than prices it can't
// verify (non-negotiable #1). The caller turns a thrown error / empty result
// into an honest down-state.
//
// Everything downstream (Claude explanation, risk detection, the cards) runs on
// the normalized shape and doesn't care which mode produced it.
import { demoFlights } from "./demo-flights";
import { searchSerpApiFlights, searchSerpApiRoundTrip } from "./serpapi";
import { normalizeSerpApi, normalizeRoundTrip, normalizePriceInsights } from "./normalize-serpapi";

// A live search can return dozens of results. Keep the cheapest few so the cards
// stay scannable and we don't send a huge (token-heavy) list to Claude.
const MAX_RESULTS = 6;

export async function getFlights(search) {
  const source = (process.env.FAREWISE_DATA_SOURCE || "serpapi").toLowerCase();

  if (source === "demo") {
    // LOCAL DEV ONLY. Hardcoded flights for building the UI. Never in production.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "FAREWISE_DATA_SOURCE=demo is local-development-only and must never run in production."
      );
    }
    // Demo data has no real price context — null, never invented.
    return { flights: demoFlights, priceInsights: null, source: "demo" };
  }

  // Production default: SerpApi. Real data only — no fallback to demo/fake.

  // Round trip (a return date is set): two calls — outbound, then its returns.
  if (search.returnDate) {
    const { outbound, returnsJson, priceInsights } = await searchSerpApiRoundTrip(search);
    const flights = sortAndCap(normalizeRoundTrip(outbound, returnsJson, search));
    if (flights.length === 0) {
      throw new Error("NO_RETURN: SerpApi returned no round-trip options for this search.");
    }
    const pi = priceInsights ? normalizePriceInsights({ price_insights: priceInsights }) : null;
    return { flights, priceInsights: pi, source: "serpapi" };
  }

  // One way (no return date): single call.
  const json = await searchSerpApiFlights(search);
  const flights = sortAndCap(normalizeSerpApi(json, search));
  if (flights.length === 0) {
    // Empty result is treated like a failure on purpose (per the spec): we won't
    // pretend, and we won't backfill with demo data. Honest down-state instead.
    throw new Error("NO_FLIGHTS: SerpApi returned no usable flights for this search.");
  }

  // Per-search price context from the SAME response (no extra API cost). null if
  // SerpApi didn't include it — we then show and say nothing about it.
  const priceInsights = normalizePriceInsights(json);
  return { flights, priceInsights, source: "serpapi" };
}

// Cheapest first (neutral, value-based — price only, nothing commercial), then
// keep only the top MAX_RESULTS for the cards + the explanation step.
function sortAndCap(flights) {
  return [...flights].sort((a, b) => a.price - b.price).slice(0, MAX_RESULTS);
}
