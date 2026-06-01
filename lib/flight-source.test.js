import { describe, it, expect, afterEach } from "vitest";
import { getFlights } from "./flight-source.js";

const search = { origin: "MIA", destination: "BER", depart: "2026-07-10", cabin: "economy" };

describe("getFlights data-source toggle", () => {
  const original = process.env.FAREWISE_DATA_SOURCE;
  afterEach(() => {
    if (original === undefined) delete process.env.FAREWISE_DATA_SOURCE;
    else process.env.FAREWISE_DATA_SOURCE = original;
  });

  it("defaults to the hand-written demo flights (no Duffel)", async () => {
    delete process.env.FAREWISE_DATA_SOURCE;
    const flights = await getFlights(search);
    expect(flights.length).toBeGreaterThan(0);
    expect(flights[0].id).toMatch(/^fw_/); // demo ids
  });

  it("sample mode normalizes the saved Duffel response, cheapest first", async () => {
    process.env.FAREWISE_DATA_SOURCE = "sample";
    const flights = await getFlights(search);
    expect(flights.map((f) => f.id)).toEqual(["off_sample_tap", "off_sample_lh"]); // 452 < 690
    expect(flights[0].bookingType).toBe("single-ticket");
    expect(flights[0].cabinOptions).toEqual([{ cabin: "economy", price: 452 }]);
  });
});
