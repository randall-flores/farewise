import { describe, it, expect } from "vitest";
import { normalizeOffer, normalizeOffers } from "./normalize-duffel.js";
import sample from "./duffel-sample.json";

const offers = sample.data.offers;
const search = { origin: "MIA", destination: "BER", depart: "2026-07-10", cabin: "economy" };

describe("normalizeOffer — TAP 1-stop", () => {
  const f = normalizeOffer(offers[0], search);

  it("maps id, price (rounded int), and currency", () => {
    expect(f.id).toBe("off_sample_tap");
    expect(f.price).toBe(452); // "452.30" rounded
    expect(f.currency).toBe("USD");
  });

  it("maps both segments with airline name and IATA+number flight code", () => {
    expect(f.segments).toHaveLength(2);
    expect(f.segments[0]).toMatchObject({
      from: "MIA",
      to: "LIS",
      airline: "TAP Air Portugal",
      flightNo: "TP202",
      depart: "2026-07-10T18:40:00",
      arrive: "2026-07-11T07:10:00",
      duration: "7h 30m",
    });
    expect(f.segments[1].flightNo).toBe("TP534");
  });

  it("derives stops, totalDuration, and the first layover from the times", () => {
    expect(f.stops).toBe(1);
    expect(f.totalDuration).toBe("11h 30m");
    expect(f.layover).toBe("1h 50m"); // 07:10 -> 09:00
  });

  it("treats every Duffel offer as a single ticket and protected", () => {
    expect(f.bookingType).toBe("single-ticket");
    expect(f.protected).toBe(true);
  });

  it("derives baggage from the segment passenger baggages", () => {
    expect(f.baggage).toEqual({ carryOn: true, checked: 0 });
  });

  it("does NOT invent à-la-carte fees, and flags them as unknown (feesKnown:false)", () => {
    expect(f.extraFees).toEqual({ firstBag: 0, seatSelect: 0, payment: 0 });
    expect(f.feesKnown).toBe(false);
  });

  it("lists ONLY the searched cabin — never a fabricated upgrade price", () => {
    expect(f.cabinOptions).toEqual([{ cabin: "economy", price: 452 }]);
  });

  it("uses refund condition for refundable, and owner for bookVia", () => {
    expect(f.refundable).toBe(false);
    expect(f.bookVia.name).toBe("TAP Air Portugal");
  });
});

describe("normalizeOffer — Lufthansa nonstop", () => {
  const f = normalizeOffer(offers[1], search);

  it("has no stops and an empty layover", () => {
    expect(f.stops).toBe(0);
    expect(f.layover).toBe("");
    expect(f.totalDuration).toBe("9h 55m");
  });

  it("reflects an included checked bag and a refundable fare", () => {
    expect(f.baggage).toEqual({ carryOn: true, checked: 1 });
    expect(f.refundable).toBe(true);
  });
});

describe("normalizeOffers", () => {
  it("normalizes every offer in the array", () => {
    const list = normalizeOffers(offers, search);
    expect(list).toHaveLength(2);
    expect(list.map((f) => f.id)).toEqual(["off_sample_tap", "off_sample_lh"]);
  });
});
