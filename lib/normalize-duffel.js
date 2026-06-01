// lib/normalize-duffel.js
// Pure (no SDK, no network): map a Duffel offer into our app's flightResult shape.
// Kept SDK-free so it can be unit-tested against a saved sample with no API calls.
//
// HONESTY (non-negotiable #1): we only map fields Duffel actually returns.
// Where Duffel doesn't give us something (à-la-carte bag/seat fees, other-cabin
// prices), we DO NOT invent a value — we leave it at a neutral default and never
// assert a fact we can't back up.

// "PT11H30M" -> "11h 30m" ; "PT9H55M" -> "9h 55m" ; "PT50M" -> "50m"
function isoDurationToText(iso) {
  if (!iso) return "";
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?/.exec(iso);
  if (!m) return "";
  const h = m[1] ? Number(m[1]) : 0;
  const min = m[2] ? Number(m[2]) : 0;
  return minutesToText(h * 60 + min);
}

function minutesToText(total) {
  if (!Number.isFinite(total) || total <= 0) return "";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

// Gap between landing one flight and departing the next, as "1h 50m".
function gapText(arriveISO, departISO) {
  if (!arriveISO || !departISO) return "";
  const mins = Math.round((new Date(departISO) - new Date(arriveISO)) / 60000);
  return minutesToText(mins);
}

// Duffel lists baggage per passenger per segment. Collapse the first segment's
// first passenger into our simple { carryOn, checked } shape.
function deriveBaggage(segment) {
  const bags = segment?.passengers?.[0]?.baggages || [];
  let carryOn = false;
  let checked = 0;
  for (const b of bags) {
    if (b.type === "carry_on" && (b.quantity || 0) > 0) carryOn = true;
    if (b.type === "checked") checked += b.quantity || 0;
  }
  return { carryOn, checked };
}

export function normalizeOffer(offer, search = {}) {
  const slice = offer.slices?.[0] || {}; // Phase 2a: one journey per card (outbound slice)
  const rawSegs = slice.segments || [];

  const segments = rawSegs.map((seg) => ({
    from: seg.origin?.iata_code,
    to: seg.destination?.iata_code,
    airline: seg.marketing_carrier?.name || offer.owner?.name || "Unknown airline",
    flightNo: `${seg.marketing_carrier?.iata_code || ""}${seg.marketing_carrier_flight_number || ""}`,
    depart: seg.departing_at,
    arrive: seg.arriving_at,
    duration: isoDurationToText(seg.duration),
  }));

  const stops = Math.max(0, segments.length - 1);
  const price = Math.round(parseFloat(offer.total_amount));
  const cabin = search.cabin || rawSegs[0]?.passengers?.[0]?.cabin_class || "economy";

  return {
    id: offer.id,
    price,
    currency: offer.total_currency,
    cabin,

    totalDuration: isoDurationToText(slice.duration),
    stops,
    segments,

    // Every Duffel offer is a single ticketed order — never a self-transfer.
    bookingType: "single-ticket",
    protected: true,
    layover: stops > 0 ? gapText(rawSegs[0].arriving_at, rawSegs[1].departing_at) : "",
    baggage: deriveBaggage(rawSegs[0]),

    // Duffel's basic offer doesn't itemize bag/seat/payment fees. We DON'T invent
    // them. feesKnown:false tells the UI and Claude these are UNKNOWN, not $0,
    // so we never imply a flight has no add-on fees when we simply don't know.
    extraFees: { firstBag: 0, seatSelect: 0, payment: 0 },
    feesKnown: false,

    refundable: offer.conditions?.refund_before_departure?.allowed ?? false,

    // Only the cabin actually returned. We never fabricate an upgrade price.
    cabinOptions: [{ cabin, price }],

    // We redirect to book; Duffel's test data has no deep link, so a placeholder
    // stands in until affiliate links arrive (roadmap Phase 3).
    bookVia: { name: offer.owner?.name || "the airline", url: "https://placeholder-affiliate-link" },
  };
}

export function normalizeOffers(offers = [], search = {}) {
  return offers.map((offer) => normalizeOffer(offer, search));
}

// Duffel place suggestions -> dropdown entries { code, label, type, underCity }.
//
// Most travelers know cities, not airport names, and big cities have several
// airports — so we lead with the CITY (search-all-airports) and list that city's
// specific airports right under it. Every entry shows a readable name + its code
// so the user always knows exactly what they're selecting. Codeless places are
// skipped (we search by code), and a code is never shown twice.
export function normalizePlaces(places = []) {
  const out = [];
  const seen = new Set();
  const add = (entry) => {
    if (entry.code && !seen.has(entry.code)) {
      seen.add(entry.code);
      out.push(entry);
    }
  };

  // 1) Cities first, each immediately followed by its own airports.
  for (const p of places) {
    if (p.type !== "city" || !p.iata_code) continue;
    const airports = (p.airports || []).filter((a) => a.iata_code);
    const label =
      airports.length > 1 ? `${p.name} (${p.iata_code}) — all airports` : `${p.name} (${p.iata_code})`;
    add({ code: p.iata_code, label, type: "city", city: p.name, underCity: false });
    for (const a of airports) {
      add({ code: a.iata_code, label: `${a.name} (${a.iata_code})`, type: "airport", city: p.name, underCity: true });
    }
  }

  // 2) Then any standalone airports not already shown under a city.
  for (const p of places) {
    if (p.type !== "airport" || !p.iata_code) continue;
    add({ code: p.iata_code, label: `${p.name} (${p.iata_code})`, type: "airport", city: p.city_name || p.name, underCity: false });
  }

  return out;
}
