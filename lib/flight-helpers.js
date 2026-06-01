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
        ? "These are two separate tickets, not one booking. If the first flight is late you're protected and get rebooked, but a missed flight still means delays."
        : "These are two separate tickets with no protection between them. If the first flight is late and you miss the second, no one rebooks you — you lose that ticket and pay again.",
    });
  }

  const layoverMin = durationToMinutes(flight.layover);
  if (layoverMin !== null && flight.stops > 0 && layoverMin < 90) {
    risks.push({
      type: "tight-connection",
      severity: layoverMin < 60 ? "high" : "warn",
      message: `Only ${flight.layover} to change flights. If the first flight runs late, you may not make the second.`,
    });
  }

  // Airport change: a flight lands at one airport but the next flight departs from another.
  // That's a separate cross-city transfer the headline itinerary hides.
  const segs = flight.segments || [];
  for (let i = 0; i < segs.length - 1; i++) {
    if (segs[i].to !== segs[i + 1].from) {
      risks.push({
        type: "airport-change",
        severity: "high",
        message: `You land at ${segs[i].to} but the next flight leaves from a different airport (${segs[i + 1].from}). You'd have to get across the city with your bags and check in again, in time.`,
      });
    }
  }

  // Round trip: run the same connection checks on the RETURN leg.
  const retSegs = flight.returnSegments || [];
  for (let i = 0; i < retSegs.length - 1; i++) {
    if (retSegs[i].to !== retSegs[i + 1].from) {
      risks.push({
        type: "airport-change",
        severity: "high",
        message: `On the way back you land at ${retSegs[i].to} but the next flight leaves from a different airport (${retSegs[i + 1].from}). You'd have to get across the city with your bags and check in again, in time.`,
      });
    }
  }
  const retLayoverMin = durationToMinutes(flight.returnLayover);
  if (retLayoverMin !== null && flight.returnStops > 0 && retLayoverMin < 90) {
    risks.push({
      type: "tight-connection",
      severity: retLayoverMin < 60 ? "high" : "warn",
      message: `Only ${flight.returnLayover} to change flights on the way back. If the first flight runs late, you may not make the second.`,
    });
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
        message: "This price is far below the others and may be a mistake fare the airline can cancel, even after you book. Don't make non-refundable plans around it until the price is confirmed.",
      });
    }
  }

  const fees = totalExtraFees(flight);
  if (fees >= 50) {
    risks.push({
      type: "high-extra-fees",
      severity: "info",
      message: `About ${formatMoney(fees, flight.currency)} in likely extra fees (bags, seat) on top of the price shown.`,
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
