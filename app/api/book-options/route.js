// app/api/book-options/route.js
// Lazy, server-only booking-options fetch (the deferred "how to book" step).
// The browser POSTs the result's booking_token + the ORIGINAL search context;
// we call SerpApi's second google_flights pass and normalize booking_options[].
// SERPAPI_KEY stays on the server. We never fabricate a link or a price.
import { fetchSerpApiBookingOptions } from "@/lib/serpapi";
import { normalizeBookingOptions } from "@/lib/normalize-serpapi";

// Cache normalized options by booking_token for ~30 min so re-expanding the same
// card doesn't spend another SerpApi credit. Module-scoped Map (per server
// instance); fine for this use — it's a cost saver, not a source of truth.
const TTL_MS = 30 * 60 * 1000;
const cache = new Map(); // token -> { at: number, options: [] }

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  const { token, departure_id, arrival_id, outbound_date, return_date } = body || {};
  if (!token || !departure_id || !arrival_id || !outbound_date) {
    return Response.json({ error: "Missing booking token or search context." }, { status: 400 });
  }

  // Cache hit (still fresh) -> no API call.
  const hit = cache.get(token);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return Response.json({ options: hit.options, cached: true });
  }

  let json;
  try {
    json = await fetchSerpApiBookingOptions({
      token,
      departureId: departure_id,
      arrivalId: arrival_id,
      outboundDate: outbound_date,
      returnDate: return_date || "", // round trip -> seller link covers both legs
    });
  } catch (err) {
    console.error("book-options route error:", err);
    return Response.json(
      {
        error:
          "We couldn't load booking options for this flight right now. FareWise won't show a link it can't stand behind — try again in a moment.",
      },
      { status: 502 }
    );
  }

  const options = normalizeBookingOptions(json);
  cache.set(token, { at: Date.now(), options });
  return Response.json({ options, cached: false });
}
