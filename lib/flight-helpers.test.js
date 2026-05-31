import { describe, it, expect } from "vitest";
import { allInPrice } from "./flight-helpers.js";
import { detectRisks } from "./flight-helpers.js";
import { reconcileVerdict } from "./flight-helpers.js";

describe("allInPrice", () => {
  it("adds the likely add-on fees to the headline price", () => {
    const flight = { price: 420, extraFees: { firstBag: 35, seatSelect: 12, payment: 0 } };
    expect(allInPrice(flight)).toBe(467);
  });

  it("returns the headline price when there are no extra fees", () => {
    const flight = { price: 690, extraFees: {} };
    expect(allInPrice(flight)).toBe(690);
  });
});

describe("detectRisks — airport change", () => {
  const airportChangeFlight = {
    id: "x", price: 360, currency: "USD", stops: 1, bookingType: "single-ticket",
    protected: true, layover: "2h 00m", extraFees: {},
    segments: [
      { from: "MIA", to: "LGW", airline: "Norse", flightNo: "Z1", duration: "7h" },
      { from: "STN", to: "BER", airline: "Ryanair", flightNo: "F1", duration: "2h" },
    ],
  };

  it("flags a high-severity risk when arrival and next-departure airports differ", () => {
    const risks = detectRisks(airportChangeFlight, [airportChangeFlight]);
    const change = risks.find((r) => r.type === "airport-change");
    expect(change).toBeTruthy();
    expect(change.severity).toBe("high");
    expect(change.message).toContain("LGW");
    expect(change.message).toContain("STN");
  });

  it("does NOT flag an airport change when the connection airport is the same", () => {
    const sameAirport = {
      ...airportChangeFlight,
      segments: [
        { from: "MIA", to: "LIS", airline: "TAP", flightNo: "T1", duration: "7h" },
        { from: "LIS", to: "BER", airline: "TAP", flightNo: "T2", duration: "3h" },
      ],
    };
    const risks = detectRisks(sameAirport, [sameAirport]);
    expect(risks.find((r) => r.type === "airport-change")).toBeFalsy();
  });
});

describe("reconcileVerdict", () => {
  it("forces high-risk when any flag is high severity", () => {
    expect(reconcileVerdict("good", [{ severity: "high" }])).toBe("high-risk");
  });

  it("floors a good verdict to caution when a warn flag exists", () => {
    expect(reconcileVerdict("good", [{ severity: "warn" }])).toBe("caution");
  });

  it("leaves a good verdict alone when only info flags exist", () => {
    expect(reconcileVerdict("good", [{ severity: "info" }])).toBe("good");
  });

  it("keeps a stricter AI verdict even with no flags", () => {
    expect(reconcileVerdict("high-risk", [])).toBe("high-risk");
  });

  it("falls back to 'good' for an unknown verdict value", () => {
    expect(reconcileVerdict("amazing", [])).toBe("good");
  });
});
