// lib/airport-search.js
// Pure, offline airport/city autocomplete over a bundled dataset (airports.json).
// Replaces the old Duffel-backed /api/places call: no network, no API key, no
// per-keystroke quota burn. Safe to import in a client component.
//
// To extend coverage: append objects to lib/airports.json in the shape
//   { "code": "IATA", "name": "Airport Name", "city": "City", "country": "Country" }
import airports from "./airports.json";

// Ranked match: exact code > code prefix > city prefix > city/name/country
// substring. Returns dropdown entries in the shape the AirportField expects.
export function searchAirports(query, limit = 8) {
  const q = (query || "").trim().toLowerCase();
  if (q.length < 2) return [];

  const scored = [];
  for (const a of airports) {
    const code = a.code.toLowerCase();
    const city = a.city.toLowerCase();
    const name = a.name.toLowerCase();
    const country = a.country.toLowerCase();

    let score = -1;
    if (code === q) score = 0;
    else if (code.startsWith(q)) score = 1;
    else if (city.startsWith(q)) score = 2;
    else if (city.includes(q)) score = 3;
    else if (name.includes(q)) score = 4;
    else if (country.includes(q)) score = 5;

    if (score >= 0) scored.push({ a, score });
  }

  scored.sort((x, y) => x.score - y.score || x.a.city.localeCompare(y.a.city));

  return scored.slice(0, limit).map(({ a }) => ({
    code: a.code,
    // Plain, recognizable label: city first (what people know), code, then the
    // airport name to disambiguate multi-airport cities (London LHR vs LGW).
    label: `${a.city} (${a.code}) — ${a.name}`,
    type: "airport",
    city: a.city,
    underCity: false,
  }));
}
