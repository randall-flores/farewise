import { describe, it, expect } from "vitest";
import {
  PASSENGER_DEFAULTS,
  totalPassengers,
  canIncrement,
  canDecrement,
  adjust,
  passengerSummary,
} from "./passengers.js";

describe("passenger rules", () => {
  it("defaults to one adult", () => {
    expect(PASSENGER_DEFAULTS).toEqual({ adults: 1, children: 0, infantsInSeat: 0, infantsOnLap: 0 });
  });

  it("keeps at least one adult", () => {
    const counts = { adults: 1, children: 0, infantsInSeat: 0, infantsOnLap: 0 };
    expect(canDecrement(counts, "adults")).toBe(false);
    expect(adjust(counts, "adults", -1)).toBe(counts); // returned unchanged
  });

  it("lap infants cannot exceed adults", () => {
    const counts = { adults: 2, children: 0, infantsInSeat: 0, infantsOnLap: 2 };
    expect(canIncrement(counts, "infantsOnLap")).toBe(false);
    expect(adjust(counts, "infantsOnLap", 1)).toBe(counts);
  });

  it("allows a lap infant when under the adult count", () => {
    const counts = { adults: 2, children: 0, infantsInSeat: 0, infantsOnLap: 1 };
    expect(canIncrement(counts, "infantsOnLap")).toBe(true);
    expect(adjust(counts, "infantsOnLap", 1).infantsOnLap).toBe(2);
  });

  it("reduces lap infants when adults drop below them", () => {
    const counts = { adults: 2, children: 0, infantsInSeat: 0, infantsOnLap: 2 };
    const next = adjust(counts, "adults", -1);
    expect(next.adults).toBe(1);
    expect(next.infantsOnLap).toBe(1);
  });

  it("caps total passengers at 9", () => {
    const counts = { adults: 6, children: 3, infantsInSeat: 0, infantsOnLap: 0 }; // 9
    expect(totalPassengers(counts)).toBe(9);
    expect(canIncrement(counts, "adults")).toBe(false);
    expect(canIncrement(counts, "children")).toBe(false);
    expect(adjust(counts, "children", 1)).toBe(counts);
  });

  it("still allows decrement at the cap", () => {
    const counts = { adults: 6, children: 3, infantsInSeat: 0, infantsOnLap: 0 };
    expect(canDecrement(counts, "children")).toBe(true);
    expect(adjust(counts, "children", -1).children).toBe(2);
  });
});

describe("passengerSummary", () => {
  it("one adult", () => {
    expect(passengerSummary({ adults: 1, children: 0, infantsInSeat: 0, infantsOnLap: 0 })).toBe("1 adult");
  });
  it("pluralizes adults", () => {
    expect(passengerSummary({ adults: 2, children: 0, infantsInSeat: 0, infantsOnLap: 0 })).toBe("2 adults");
  });
  it("adds children with correct plural", () => {
    expect(passengerSummary({ adults: 2, children: 1, infantsInSeat: 0, infantsOnLap: 0 })).toBe("2 adults, 1 child");
    expect(passengerSummary({ adults: 1, children: 2, infantsInSeat: 0, infantsOnLap: 0 })).toBe("1 adult, 2 children");
  });
  it("merges infants in seat and on lap into one infant count", () => {
    expect(passengerSummary({ adults: 2, children: 0, infantsInSeat: 1, infantsOnLap: 0 })).toBe("2 adults, 1 infant");
    expect(passengerSummary({ adults: 2, children: 0, infantsInSeat: 1, infantsOnLap: 1 })).toBe("2 adults, 2 infants");
  });
  it("combines all types", () => {
    expect(passengerSummary({ adults: 2, children: 1, infantsInSeat: 1, infantsOnLap: 1 })).toBe("2 adults, 1 child, 2 infants");
  });
});
