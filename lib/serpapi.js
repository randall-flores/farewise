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
  if (json.error) throw new Error(`SerpApi error: ${json.error}`); // error even on HTTP 200
  return json;
}

// One-way (type=2). Returns the raw JSON for the normalizer.
export async function searchSerpApiFlights(search) {
  return serpGet(buildParams(search, { type: "2", outbound_date: search.depart }));
}

// Round-trip (type=1), two calls. Returns the chosen outbound option (cheapest),
// the raw JSON of its return options, and the price_insights from call 1.
// Return options come back in `other_flights` (call 2 leaves `best_flights` empty).
export async function searchSerpApiRoundTrip(search) {
  const j1 = await serpGet(buildParams(search, { type: "1", return_date: search.returnDate }));

  const outbounds = [...(j1.best_flights || []), ...(j1.other_flights || [])].filter(
    (o) => typeof o.price === "number" && o.departure_token
  );
  // Cheapest outbound (neutral, value-based). Its returns become the round trips.
  const outbound = [...outbounds].sort((a, b) => a.price - b.price)[0] || null;
  if (!outbound) {
    return { outbound: null, returnsJson: { best_flights: [], other_flights: [] }, priceInsights: j1.price_insights };
  }

  const j2 = await serpGet(
    buildParams(search, { type: "1", return_date: search.returnDate, departure_token: outbound.departure_token })
  );
  return { outbound, returnsJson: j2, priceInsights: j1.price_insights };
}

// Booking options for one chosen result. Needs the SAME search context + the
// result's booking_token. For a round trip pass returnDate so the call is type=1
// and the seller link covers BOTH legs. Returns raw JSON (json.booking_options[]).
export async function fetchSerpApiBookingOptions({ departureId, arrivalId, outboundDate, returnDate, token }) {
  requireKey();
  if (!token || !departureId || !arrivalId || !outboundDate) {
    throw new Error("fetchSerpApiBookingOptions needs token + departureId + arrivalId + outboundDate.");
  }
  const roundTrip = Boolean(returnDate);
  const params = buildParams(
    { origin: departureId, destination: arrivalId, depart: outboundDate },
    {
      type: roundTrip ? "1" : "2",
      return_date: roundTrip ? returnDate : undefined,
      booking_token: token,
    }
  );
  return serpGet(params);
}
