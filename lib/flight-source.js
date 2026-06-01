// lib/flight-source.js
// Single place that decides WHERE flight data comes from, so day-to-day dev
// never burns real Duffel calls. Set the mode with FAREWISE_DATA_SOURCE:
//
//   "demo"   (default) — hand-written demoFlights, no Duffel at all
//   "sample"           — run the real normalizer over a saved Duffel response
//                        (exercises the live code path, still zero API calls)
//   "live"             — actually hit Duffel (only when you mean to)
//
// Everything downstream (Claude explanation, risk detection, the cards) runs on
// the normalized shape and doesn't care which mode produced it.
import { demoFlights } from "./demo-flights";
import { normalizeOffers } from "./normalize-duffel";
import { searchDuffel } from "./duffel";
import duffelSample from "./duffel-sample.json";

// Live searches can return dozens of offers. Keep the cheapest few so the cards
// stay scannable and we don't send a huge (token-heavy) list to Claude.
const MAX_RESULTS = 6;

export async function getFlights(search) {
  const source = (process.env.FAREWISE_DATA_SOURCE || "demo").toLowerCase();

  if (source === "live") {
    const offers = await searchDuffel(search);
    return sortAndCap(normalizeOffers(offers, search));
  }

  if (source === "sample") {
    const offers = duffelSample.data?.offers || [];
    return sortAndCap(normalizeOffers(offers, search));
  }

  // default: demo data, untouched
  return demoFlights;
}

// Cheapest first (neutral, value-based — price only, nothing commercial), then
// keep only the top MAX_RESULTS for the cards + the explanation step.
function sortAndCap(flights) {
  return [...flights].sort((a, b) => a.price - b.price).slice(0, MAX_RESULTS);
}
