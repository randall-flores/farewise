// One-off generator: build lib/airports.json from OurAirports (public domain).
// Run: node scripts/build-airports.mjs
// Sources every airport that has a 3-letter IATA code. Not shipped/imported at
// runtime — the output JSON is. Safe to delete after running, or keep to refresh.
import { writeFileSync } from "node:fs";

const AIRPORTS = "https://davidmegginson.github.io/ourairports-data/airports.csv";
const COUNTRIES = "https://davidmegginson.github.io/ourairports-data/countries.csv";

// Minimal RFC-4180-ish CSV parser (handles quotes, commas-in-quotes, "" escapes).
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function toObjects(rows) {
  const header = rows[0];
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  return { idx, rows: rows.slice(1) };
}

const [airportsCsv, countriesCsv] = await Promise.all([
  fetch(AIRPORTS).then((r) => r.text()),
  fetch(COUNTRIES).then((r) => r.text()),
]);

const { idx: cIdx, rows: cRows } = toObjects(parseCSV(countriesCsv));
const countryName = {};
for (const r of cRows) countryName[r[cIdx.code]] = r[cIdx.name];

// Importance weight so the matcher can rank big, scheduled airports above tiny
// airstrips when a city/country matches many. Bigger = more important.
const TYPE_W = { large_airport: 4, medium_airport: 3, small_airport: 2 };

const { idx: aIdx, rows: aRows } = toObjects(parseCSV(airportsCsv));
const seen = new Set();
const out = [];
for (const r of aRows) {
  const iata = (r[aIdx.iata_code] || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(iata) || seen.has(iata)) continue;
  seen.add(iata);
  const w = (TYPE_W[r[aIdx.type]] ?? 1) + (r[aIdx.scheduled_service] === "yes" ? 2 : 0);
  out.push({
    iata,
    name: (r[aIdx.name] || "").trim(),
    city: (r[aIdx.municipality] || "").trim(),
    country: countryName[r[aIdx.iso_country]] || (r[aIdx.iso_country] || "").trim(),
    w,
  });
}

out.sort((a, b) => a.iata.localeCompare(b.iata));
writeFileSync("lib/airports.json", JSON.stringify(out));
console.log(`Wrote lib/airports.json with ${out.length} airports.`);
