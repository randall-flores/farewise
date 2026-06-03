// lib/passengers.js
// Pure passenger-count logic for the travelers selector. No React, no SDK — so
// the rules (min 1 adult, lap infants ≤ adults, total cap 9) and the summary
// label are unit-tested directly.

export const PASSENGER_DEFAULTS = { adults: 1, children: 0, infantsInSeat: 0, infantsOnLap: 0 };

// Google Flights caps a single search at 9 passengers.
export const MAX_PASSENGERS = 9;

// The four counts added together.
export function totalPassengers(counts) {
  return (
    (counts.adults || 0) +
    (counts.children || 0) +
    (counts.infantsInSeat || 0) +
    (counts.infantsOnLap || 0)
  );
}

// Can the + button for this type add one more? false => button disabled.
export function canIncrement(counts, type) {
  if (totalPassengers(counts) >= MAX_PASSENGERS) return false; // total cap
  // One lap infant per adult — lap infants can't outnumber adults.
  if (type === "infantsOnLap" && counts.infantsOnLap >= counts.adults) return false;
  return true;
}

// Can the − button for this type remove one? false => button disabled.
export function canDecrement(counts, type) {
  if (type === "adults") return counts.adults > 1; // always keep at least 1 adult
  return (counts[type] || 0) > 0;
}

// Apply a +1 / −1 change with all rules enforced. Pure: returns a NEW counts
// object, or the SAME object unchanged when the change isn't allowed (so a
// disabled-button slip can never break the rules).
export function adjust(counts, type, delta) {
  if (delta > 0 && !canIncrement(counts, type)) return counts;
  if (delta < 0 && !canDecrement(counts, type)) return counts;

  const next = { ...counts, [type]: (counts[type] || 0) + delta };

  // Dropping adults below the lap-infant count pulls lap infants down to match.
  if (type === "adults" && next.infantsOnLap > next.adults) {
    next.infantsOnLap = next.adults;
  }
  return next;
}

// Human label, e.g. "2 adults, 1 child", "1 adult, 2 infants". Infants in seat
// + on lap merge into one "infant(s)" count for the label only; the panel still
// tracks them separately. Adults always show (min 1).
export function passengerSummary(counts) {
  const parts = [count(counts.adults, "adult", "adults")];
  if (counts.children > 0) parts.push(count(counts.children, "child", "children"));
  const infants = (counts.infantsInSeat || 0) + (counts.infantsOnLap || 0);
  if (infants > 0) parts.push(count(infants, "infant", "infants"));
  return parts.join(", ");
}

function count(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}
