import { describe, it, expect } from "vitest";
import { normalizeOffer, normalizeOffers, normalizePlaces } from "./normalize-duffel.js";
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

describe("normalizePlaces", () => {
  const raw = [
    {
      type: "city",
      name: "New York",
      iata_code: "NYC",
      airports: [
        { name: "John F. Kennedy International Airport", iata_code: "JFK" },
        { name: "Newark Liberty International Airport", iata_code: "EWR" },
      ],
    },
    { type: "airport", name: "John F. Kennedy International Airport", iata_code: "JFK" }, // duplicate -> skipped
    { type: "city", name: "Berlin", iata_code: "BER", airports: [{ name: "Berlin Brandenburg", iata_code: "BER" }] },
    { type: "airport", name: "London Stansted Airport", iata_code: "STN" }, // standalone
    { type: "airport", name: "No Code Field" }, // no iata_code -> skipped
  ];

  const out = normalizePlaces(raw);

  it("leads with the city, then nests that city's airports under it", () => {
    expect(out[0]).toMatchObject({ code: "NYC", label: "New York (NYC) — all airports", type: "city", underCity: false });
    expect(out[1]).toMatchObject({ code: "JFK", label: "John F. Kennedy International Airport (JFK)", type: "airport", underCity: true });
    expect(out[2]).toMatchObject({ code: "EWR", type: "airport", underCity: true });
  });

  it("drops the '— all airports' tail for a single-airport city", () => {
    const berlin = out.find((e) => e.code === "BER");
    expect(berlin).toMatchObject({ label: "Berlin (BER)", type: "city" });
  });

  it("never lists the same code twice (dedupes the standalone JFK and the BER airport)", () => {
    const codes = out.map((e) => e.code);
    expect(codes).toEqual(["NYC", "JFK", "EWR", "BER", "STN"]);
  });

  it("skips places with no IATA code", () => {
    expect(out.find((e) => e.label?.includes("No Code"))).toBeUndefined();
  });
});
