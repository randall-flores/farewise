import { describe, it, expect } from "vitest";
import { allInPrice } from "./flight-helpers.js";

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
