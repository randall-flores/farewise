// lib/serpapi.js
// Server-only SerpApi client for the Google Flights engine. NEVER import into a
// client component — SERPAPI_KEY is secret and must never reach the browser.
//
// SEARCH ONLY. One-way is one call (type=2). Round-trip is TWO calls (type=1):
//   1) outbound options, each carrying a departure_token + the round-trip total;
//   2) same params + departure_token -> the matching return options, each with a
//      booking_token that covers BOTH legs.
// We do NOT book here; booking links are fetched lazily (fetchSerpApiBookingOptions).
//
// HONESTY (non-negotiable #1): on ANY failure we throw. The caller turns that
// into an honest down-state. We never fall back to demo or invented data.

const ENDPOINT = "https://serpapi.com/search.json";

// FareWise cabin values -> Google Flights `travel_class` codes.
// 1 = Economy, 2 = Premium economy, 3 = Business, 4 = First.
const CABIN_MAP = { economy: "1", premium: "2", business: "3", first: "4" };

function requireKey() {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error("SERPAPI_KEY is not set. Add it to .env.local (server-only).");
  return key;
}

// Shared param builder: the constant search context + any extra fields (type,
// return_date, departure_token, booking_token). Drops empty extras.
function buildParams(search, extra = {}) {
  const params = new URLSearchParams({
    engine: "google_flights",
    departure_id: search.origin,
    arrival_id: search.destination,
    outbound_date: search.depart,
    travel_class: CABIN_MAP[search.cabin] || "1",
    // Passenger counts ride the same path as travel_class. Defaults mirror the
    // cabin fallback above: when search omits them (e.g. the booking-options
    // call), SerpApi's own defaults (1 adult, 0 others) apply.
    adults: String(search.adults || 1),
    children: String(search.children ?? 0),
    infants_in_seat: String(search.infantsInSeat ?? 0),
    infants_on_lap: String(search.infantsOnLap ?? 0),
    currency: "USD", // prices come back in USD (non-negotiable #7)
    hl: "en", // language
    gl: "us", // market / locale
    api_key: requireKey(),
  });
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  return params;
}

async function serpGet(params) {
  let res;
  try {
    res = await fetch(`${ENDPOINT}?${params.toString()}`);
  } catch (err) {
    throw new Error(`SerpApi request failed to send: ${err.message}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SerpApi request failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  if (json.error) {
    // SerpApi reports "no results" via the error field. That's a GENUINE empty
    // result for the query — not a malformed request — so we return it and let
    // the caller show a calm empty-state. Any other error is a real failure.
    if (/returned any results/i.test(json.error)) return json;
    throw new Error(`SerpApi error: ${json.error}`); // real error, even on HTTP 200
  }
  return json;
}

// One-way (type=2). Returns the raw JSON for the normalizer.
export async function searchSerpApiFlights(search) {
  return serpGet(buildParams(search, { type: "2", outbound_date: search.depart }));
}

// Round-trip (type=1), two calls. Returns the chosen outbound option (cheapest),
// the raw JSON of its return options, and the price_insights from call 1.
// Return options come back in `other_flights` (call 2 leaves `best_flights` empty).
// `onStage` is optional: called with "returns" once call 1 has landed and call 2
// is about to go out, so a caller can report the real halfway point of the wait.
export async function searchSerpApiRoundTrip(search, onStage) {
  if (!search.returnDate) {
    throw new Error("searchSerpApiRoundTrip called without a return date.");
  }

  // CALL 1: outbound options (type=1, both dates). deep_search=true returns the
  // browser-identical results — SerpApi's shallow default comes back empty for
  // some routes (e.g. SJO->BER) that Google Flights actually shows. Costs extra
  // latency; worth it for correct round-trip inventory.
  let j1;
  try {
    j1 = await serpGet(buildParams(search, { type: "1", return_date: search.returnDate, deep_search: "true" }));
  } catch (err) {
    console.error(`[round-trip] call 1 failed (${search.origin}->${search.destination}, out ${search.depart}, ret ${search.returnDate}):`, err.message);
    throw err;
  }

  const outbounds = [...(j1.best_flights || []), ...(j1.other_flights || [])].filter(
    (o) => typeof o.price === "number" && o.departure_token
  );
  // Cheapest outbound (neutral, value-based). Its returns become the round trips.
  const outbound = [...outbounds].sort((a, b) => a.price - b.price)[0] || null;
  console.log(
    `[round-trip] call 1 ${search.origin}->${search.destination}: outbound options=${outbounds.length}, departure_token=${Boolean(outbound?.departure_token)}`
  );
  if (!outbound) {
    return { outbound: null, returnsJson: { best_flights: [], other_flights: [] }, priceInsights: j1.price_insights };
  }

  // CALL 2: the matching return options (same params + departure_token).
  onStage?.("returns");
  let j2;
  try {
    j2 = await serpGet(
      buildParams(search, {
        type: "1",
        return_date: search.returnDate,
        departure_token: outbound.departure_token,
        deep_search: "true", // keep parity with call 1
      })
    );
  } catch (err) {
    // Surface the real SerpApi status / message instead of swallowing it.
    console.error(`[round-trip] call 2 (departure_token) failed (${search.origin}->${search.destination}):`, err.message);
    throw err;
  }
  const returnCount = (j2.best_flights || []).length + (j2.other_flights || []).length;
  console.log(`[round-trip] call 2 ${search.origin}->${search.destination}: return options=${returnCount}`);

  return { outbound, returnsJson: j2, priceInsights: j1.price_insights };
}

// Booking options for one chosen result. Needs the SAME search context + the
// result's booking_token. For a round trip pass returnDate so the call is type=1
// and the seller link covers BOTH legs. Returns raw JSON (json.booking_options[]).
export async function fetchSerpApiBookingOptions({ departureId, arrivalId, outboundDate, returnDate, token, cabin, adults, children, infantsInSeat, infantsOnLap }) {
  requireKey();
  if (!token || !departureId || !arrivalId || !outboundDate) {
    throw new Error("fetchSerpApiBookingOptions needs token + departureId + arrivalId + outboundDate.");
  }
  const roundTrip = Boolean(returnDate);
  const params = buildParams(
    { origin: departureId, destination: arrivalId, depart: outboundDate, cabin, adults, children, infantsInSeat, infantsOnLap },
    {
      type: roundTrip ? "1" : "2",
      return_date: roundTrip ? returnDate : undefined,
      // Round-trip booking_tokens come from a deep_search result; keep parity so
      // the options resolve the same itinerary.
      deep_search: roundTrip ? "true" : undefined,
      booking_token: token,
    }
  );
  return serpGet(params);
}
