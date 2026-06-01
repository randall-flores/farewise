// lib/airport-search.js
// Pure, offline airport/city autocomplete over a bundled dataset (airports.json,
// every IATA-coded airport from OurAirports — ~9k entries). Replaces the old
// Duffel /api/places call: no network, no API key, no per-keystroke quota.
//
// A query matches IATA code, airport name, city, OR country, accent-insensitive
// ("San Jose" matches "San José", "Costa Rica" surfaces SJO/LIR). Exact code and
// prefix matches rank first; within a tier, bigger/scheduled airports win.
//
// PERF: the ~844KB dataset is loaded via dynamic import the FIRST time it's
// needed (one separate chunk, kept out of the initial page bundle), parsed once,
// and indexed once. After that every keystroke is a cheap in-memory scan.
// `loadAirports()` warms it (call on focus); `searchAirports()` is sync and
// returns [] until the load resolves.
//
// To extend/refresh: re-run `node scripts/build-airports.mjs`.

let INDEX = null; // built once after the dataset loads
let indexPromise = null; // in-flight load, so we only fetch/parse once

// Fold accents and lowercase, so "san jose" matches "San José".
function fold(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function buildIndex(airports) {
  return airports.map((a) => ({
    iata: a.iata,
    name: a.name,
    city: a.city,
    country: a.country,
    w: a.w || 0,
    _iata: a.iata.toLowerCase(),
    _name: fold(a.name),
    _city: fold(a.city),
    _country: fold(a.country),
  }));
}

// Load + index the dataset once. Safe to call repeatedly (e.g. on every focus).
export function loadAirports() {
  if (INDEX) return Promise.resolve(INDEX);
  if (!indexPromise) {
    indexPromise = import("./airports.json").then((m) => {
      INDEX = buildIndex(m.default);
      return INDEX;
    });
  }
  return indexPromise;
}

// Lower tier = better match.
function tier(a, q) {
  if (a._iata === q) return 0;
  if (a._iata.startsWith(q)) return 1;
  if (a._city.startsWith(q)) return 2;
  if (a._name.startsWith(q)) return 3;
  if (a._country === q) return 4;
  if (a._city.includes(q)) return 5;
  if (a._name.includes(q)) return 6;
  if (a._country.includes(q)) return 7;
  return -1;
}

// Synchronous. Returns [] until loadAirports() has resolved.
export function searchAirports(query, limit = 8) {
  if (!INDEX) return [];
  const q = fold((query || "").trim());
  if (q.length < 2) return [];

  const scored = [];
  for (const a of INDEX) {
    const t = tier(a, q);
    if (t >= 0) scored.push({ a, t });
  }

  // tier, then importance (bigger/scheduled first), then city alphabetically.
  scored.sort((x, y) => x.t - y.t || y.a.w - x.a.w || x.a.city.localeCompare(y.a.city));

  return scored.slice(0, limit).map(({ a }) => ({
    code: a.iata,
    label: a.city ? `${a.city} (${a.iata}) — ${a.name}` : `${a.name} (${a.iata})`,
    country: a.country,
    type: "airport",
    city: a.city,
    underCity: false,
  }));
}
