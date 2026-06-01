// lib/normalize-serpapi.js
// Pure (no network): map a SerpApi google_flights response into our app's
// flightResult shape. Kept SDK/network-free so it's unit-testable against a
// saved sample.
//
// HONESTY (non-negotiable #1): we only map fields SerpApi actually returns for
// a search. SerpApi's flight *search* does NOT include à-la-carte bag/seat fees,
// baggage allowance, refund rules, other-cabin prices, or a booking link. We DO
// NOT invent any of those — we mark them unknown (null / feesKnown:false) so the
// UI and Claude never imply a fact we can't back up.

// 120 -> "2h", 110 -> "1h 50m", 45 -> "45m". Returns "" for unknown/zero.
function minutesToText(total) {
  if (!Number.isFinite(total) || total <= 0) return "";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

// SerpApi times look like "2026-07-10 18:40". Our shape uses ISO-ish
// "2026-07-10T18:40" (same string the demo data uses, parseable by Date()).
function toIso(time) {
  if (!time) return "";
  return time.replace(" ", "T");
}

// First layover only for now. The flightResult shape carries a single `layover`
// string; multi-stop layovers beyond the first are represented by the segment
// list and the airport-change risk check. (Round-trip/extra layovers: later.)
function firstLayover(item) {
  const lay = item.layovers?.[0];
  return lay ? minutesToText(lay.duration) : "";
}

export function normalizeSerpFlight(item, index, search = {}) {
  const rawSegs = Array.isArray(item.flights) ? item.flights : [];

  const segments = rawSegs.map((f) => ({
    from: f.departure_airport?.id,
    to: f.arrival_airport?.id,
    airline: f.airline || "Unknown airline",
    flightNo: f.flight_number || "",
    depart: toIso(f.departure_airport?.time),
    arrive: toIso(f.arrival_airport?.time),
    duration: minutesToText(f.duration),
  }));

  const stops = Math.max(0, segments.length - 1);
  const price = Math.round(Number(item.price));
  const cabin = search.cabin || "economy";
  const airline = rawSegs[0]?.airline || "the airline";

  return {
    // SerpApi gives no stable per-result id, so we key by position in the list.
    id: `fw_serp_${index}`,
    price,
    currency: "USD",
    cabin,

    totalDuration: minutesToText(item.total_duration),
    stops,
    segments,

    // SerpApi's search response exposes NO separate-ticket / self-transfer signal
    // (verified against the live response — items carry only flights, layovers,
    // total_duration, carbon_emissions, price, type, airline_logo, booking_token).
    // So we CANNOT prove this is a single ticket or that the traveler is protected
    // if a connection is missed. We leave both unknown rather than assert a
    // protection we haven't verified (honesty, same as `refundable`). The
    // airport-change risk (derived from the segment list) still fires honestly.
    bookingType: null,
    protected: null,
    layover: stops > 0 ? firstLayover(item) : "",

    // UNKNOWN from a SerpApi search. Don't invent — null means "we don't know",
    // which is different from false/0.
    baggage: { carryOn: null, checked: null },
    extraFees: {}, // no fee data in search results
    feesKnown: false, // tells the UI/Claude: fees UNKNOWN, not $0
    refundable: null, // unknown, never asserted

    // Only the cabin actually searched. We never fabricate an upgrade price.
    cabinOptions: [{ cabin, price }],

    // We redirect to book and we DON'T fetch seller links on the results page.
    // url stays null. For a ONE-WAY result SerpApi attaches `booking_token` (used
    // to fetch booking options) — NOT `departure_token`, which only appears on
    // round-trip searches to fetch the return legs. Verified against the live
    // response: one-way results carry booking_token, never departure_token. Keep
    // it so a later lazy fetch — on card expand / book click — resolves real links.
    // TODO(phase: booking links): fetch booking options here with bookVia.token.
    bookVia: { name: airline, url: null, token: item.booking_token || null },
  };
}

export function normalizeSerpApi(json = {}, search = {}) {
  const items = [...(json.best_flights || []), ...(json.other_flights || [])];
  return items
    // Drop anything without a verifiable numeric price — we won't show a fare
    // we can't read off the data. (Number(null) is 0, so check the type first.)
    .filter((item) => typeof item.price === "number" && Number.isFinite(item.price))
    .map((item, i) => normalizeSerpFlight(item, i, search));
}

// Per-SEARCH price context (not per-flight). SerpApi already includes this in the
// same search response — no extra API cost. We pass through ONLY the fields it
// gives, and assert nothing when they're missing: a null here means "we don't
// know how this fare compares", never an invented baseline.
export function normalizePriceInsights(json = {}) {
  const pi = json.price_insights;
  if (!pi) return null;

  const priceLevel = ["low", "typical", "high"].includes(pi.price_level) ? pi.price_level : null;
  const lowestPrice = typeof pi.lowest_price === "number" ? Math.round(pi.lowest_price) : null;

  const r = pi.typical_price_range;
  const typicalPriceRange =
    Array.isArray(r) && typeof r[0] === "number" && typeof r[1] === "number"
      ? [Math.round(r[0]), Math.round(r[1])]
      : null;

  // Nothing usable -> null, so the UI and Claude show/say nothing.
  if (priceLevel === null && lowestPrice === null && typicalPriceRange === null) return null;

  return { lowestPrice, priceLevel, typicalPriceRange };
}

// ── Booking options (second SerpApi call, lazy) ───────────────────────────────
// Each raw option wraps its detail in `together` (one ticket) or `separate`
// (separate tickets — a real risk we surface). We map ONLY what's present and
// invent nothing: `airline` is true for airline-direct and ABSENT for third
// parties (never false), so isAirlineDirect is a strict `=== true`. extensions
// (fare conditions) and option_title are frequently missing — default to [] /
// null, never a fabricated condition. No redirect data -> redirect: null (we
// won't show a book button we can't actually submit).
export function normalizeBookingOption(option = {}) {
  const separate = option.separate || null;
  const t = option.together || separate || null;
  if (!t) return null;

  const br = t.booking_request || {};
  const redirect =
    typeof br.url === "string" && typeof br.post_data === "string"
      ? { url: br.url, postData: br.post_data }
      : null;

  return {
    seller: typeof t.book_with === "string" ? t.book_with : "the seller",
    isAirlineDirect: t.airline === true,
    optionTitle: typeof t.option_title === "string" ? t.option_title : null,
    price: typeof t.price === "number" ? Math.round(t.price) : null,
    fareConditions: Array.isArray(t.extensions) ? t.extensions : [],
    baggagePrices: Array.isArray(t.baggage_prices) ? t.baggage_prices : [],
    // "separate" means separate tickets — flag it so the UI can warn plainly.
    ticketKind: separate ? "separate" : "together",
    redirect,
  };
}

export function normalizeBookingOptions(json = {}) {
  const raw = Array.isArray(json.booking_options) ? json.booking_options : [];
  const options = raw.map(normalizeBookingOption).filter(Boolean);
  // Cheapest first when prices exist (neutral, value-based). Unknown prices last.
  options.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  return options;
}
