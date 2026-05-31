// lib/flight-helpers.js
// Pure helpers for flight data. Safe to import on server and client.

// Format a number as money, e.g. 420 -> "$420".
export function formatMoney(amount, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Sum the "checkout surprise" fees so we can surface a truer cost.
export function totalExtraFees(flight) {
  const f = flight.extraFees || {};
  return (f.firstBag || 0) + (f.seatSelect || 0) + (f.payment || 0);
}

// Parse "1h 50m" / "1h" / "50m" into minutes. Returns null if unknown/empty.
export function durationToMinutes(text) {
  if (!text) return null;
  const h = /(\d+)\s*h/.exec(text);
  const m = /(\d+)\s*m/.exec(text);
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

// Truer cost: headline price plus the checkout-surprise fees.
export function allInPrice(flight) {
  if (!flight) return 0;
  return flight.price + totalExtraFees(flight);
}

// The honesty core: flag risky options in plain language.
// Deterministic so a warning always exists even if the AI misses it.
export function detectRisks(flight, allFlights = []) {
  const risks = [];

  if (flight.bookingType === "self-transfer") {
    risks.push({
      type: "self-transfer",
      severity: flight.protected ? "warn" : "high",
      message: flight.protected
        ? "Separate tickets (self-transfer). You're covered if you misconnect, but a missed leg still means delays."
        : "Separate tickets (self-transfer) with NO protection. Miss the first leg and you may lose the second ticket entirely.",
    });
  }

  const layoverMin = durationToMinutes(flight.layover);
  if (layoverMin !== null && flight.stops > 0 && layoverMin < 90) {
    risks.push({
      type: "tight-connection",
      severity: layoverMin < 60 ? "high" : "warn",
      message: `Tight ${flight.layover} connection — little room if the first flight runs late.`,
    });
  }

  // Airport change: a leg lands at one airport but the next leg departs from another.
  // That's a separate cross-city transfer the headline itinerary hides.
  const segs = flight.segments || [];
  for (let i = 0; i < segs.length - 1; i++) {
    if (segs[i].to !== segs[i + 1].from) {
      risks.push({
        type: "airport-change",
        severity: "high",
        message: `Airport change: you arrive at ${segs[i].to} but the next flight leaves from ${segs[i + 1].from}. You must get yourself across the city, with your bags, in time.`,
      });
    }
  }

  // Possible mistake fare: far below the typical price of the other options.
  const others = allFlights.filter((x) => x.id !== flight.id).map((x) => x.price);
  if (others.length) {
    const sorted = [...others].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (flight.price < median * 0.55) {
      risks.push({
        type: "possible-mistake-fare",
        severity: "warn",
        message: "Suspiciously low price — could be a mistake fare the airline may cancel. Don't build non-refundable plans around it.",
      });
    }
  }

  const fees = totalExtraFees(flight);
  if (fees >= 50) {
    risks.push({
      type: "high-extra-fees",
      severity: "info",
      message: `About ${formatMoney(fees, flight.currency)} in likely add-ons (bags/seat) on top of the headline price.`,
    });
  }

  return risks;
}

// Clamp the AI's verdict against the deterministic flags so a model slip
// can only make a card MORE cautious, never hide a real risk.
export function reconcileVerdict(verdict, risks = []) {
  const valid = ["good", "caution", "high-risk"];
  const v = valid.includes(verdict) ? verdict : "good";
  if (risks.some((r) => r.severity === "high")) return "high-risk";
  // A "warn" flag only needs to act when the AI was optimistic ("good").
  // If v is already "caution" or "high-risk", we keep the stricter value.
  if (risks.some((r) => r.severity === "warn") && v === "good") return "caution";
  return v;
}
