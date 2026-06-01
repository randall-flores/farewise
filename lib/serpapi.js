// lib/serpapi.js
// Server-only SerpApi client for the Google Flights engine. NEVER import into a
// client component — SERPAPI_KEY is secret and must never reach the browser.
//
// SEARCH ONLY, ONE-WAY ONLY (Phase 2a). We read the flight results and hand the
// raw JSON to the normalizer. We do NOT book and we do NOT fetch seller/booking
// links here — those are pulled lazily later (see normalize-serpapi bookVia).
//
// HONESTY (non-negotiable #1): on ANY failure we throw. The caller turns that
// into an honest down-state. We never fall back to demo or invented data.

const ENDPOINT = "https://serpapi.com/search.json";

// FareWise cabin values -> Google Flights `travel_class` codes.
// 1 = Economy, 2 = Premium economy, 3 = Business, 4 = First.
const CABIN_MAP = { economy: "1", premium: "2", business: "3", first: "4" };

export async function searchSerpApiFlights(search) {
  const key = process.env.SERPAPI_KEY;
  if (!key) {
    throw new Error("SERPAPI_KEY is not set. Add it to .env.local (server-only).");
  }

  const params = new URLSearchParams({
    engine: "google_flights",
    departure_id: search.origin,
    arrival_id: search.destination,
    outbound_date: search.depart,
    type: "2", // 2 = one-way. Round-trip ("1" + return_date + a 2nd departure_token
    //            call) is intentionally NOT built yet — see the roadmap note in CLAUDE.md.
    travel_class: CABIN_MAP[search.cabin] || "1",
    currency: "USD", // prices come back in USD (non-negotiable #7)
    hl: "en", // language
    gl: "us", // market / locale
    api_key: key,
  });

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
  // SerpApi reports problems in an `error` field even on HTTP 200.
  if (json.error) {
    throw new Error(`SerpApi error: ${json.error}`);
  }
  return json;
}

// Second call: booking options for one chosen one-way result. Needs the SAME
// search context plus the result's booking_token. Returns the raw JSON
// (json.booking_options[]) for the normalizer. Server-only; throws on failure.
export async function fetchSerpApiBookingOptions({ departureId, arrivalId, outboundDate, token }) {
  const key = process.env.SERPAPI_KEY;
  if (!key) {
    throw new Error("SERPAPI_KEY is not set. Add it to .env.local (server-only).");
  }
  if (!token || !departureId || !arrivalId || !outboundDate) {
    throw new Error("fetchSerpApiBookingOptions needs token + departureId + arrivalId + outboundDate.");
  }

  const params = new URLSearchParams({
    engine: "google_flights",
    departure_id: departureId,
    arrival_id: arrivalId,
    outbound_date: outboundDate,
    type: "2", // one-way (matches the original search)
    currency: "USD",
    hl: "en",
    gl: "us",
    booking_token: token,
    api_key: key,
  });

  let res;
  try {
    res = await fetch(`${ENDPOINT}?${params.toString()}`);
  } catch (err) {
    throw new Error(`SerpApi booking request failed to send: ${err.message}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SerpApi booking request failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  if (json.error) throw new Error(`SerpApi booking error: ${json.error}`);
  return json;
}
