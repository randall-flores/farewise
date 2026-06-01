import { describe, it, expect } from "vitest";
import { searchAirports } from "./airport-search.js";

describe("searchAirports", () => {
  it("returns nothing for queries under 2 characters", () => {
    expect(searchAirports("")).toEqual([]);
    expect(searchAirports("l")).toEqual([]);
  });

  it("ranks an exact IATA code first", () => {
    const out = searchAirports("ber");
    expect(out[0]).toMatchObject({ code: "BER", type: "airport", underCity: false });
    expect(out[0].label).toBe("Berlin (BER) — Brandenburg");
  });

  it("matches a city by name and returns its airports", () => {
    const out = searchAirports("london");
    const codes = out.map((e) => e.code);
    expect(codes).toEqual(expect.arrayContaining(["LHR", "LGW", "STN", "LTN"]));
  });

  it("matches the demo route airports", () => {
    expect(searchAirports("miami")[0].code).toBe("MIA");
    expect(searchAirports("lisbon")[0].code).toBe("LIS");
  });

  it("respects the result limit", () => {
    expect(searchAirports("a", 5).length).toBeLessThanOrEqual(5); // (len<2 -> [], so use a real query)
    expect(searchAirports("intl", 3).length).toBeLessThanOrEqual(3);
  });
});
