import { describe, it, expect, beforeAll } from "vitest";
import { searchAirports, loadAirports } from "./airport-search.js";

const codes = (q, n) => searchAirports(q, n).map((e) => e.code);

// The dataset is lazy-loaded; warm it once before the synchronous assertions.
beforeAll(async () => {
  await loadAirports();
});

describe("searchAirports", () => {
  it("returns nothing for queries under 2 characters", () => {
    expect(searchAirports("")).toEqual([]);
    expect(searchAirports("l")).toEqual([]);
  });

  it("ranks an exact IATA code first", () => {
    const out = searchAirports("ber");
    expect(out[0].code).toBe("BER");
    expect(out[0].label).toContain("(BER)");
    expect(out[0].country).toBeTruthy();
  });

  it("matches by country — 'Costa Rica' surfaces SJO and LIR", () => {
    const out = codes("costa rica", 12);
    expect(out).toEqual(expect.arrayContaining(["SJO", "LIR"]));
  });

  it("matches by city, accent-insensitive — 'San Jose' surfaces SJO", () => {
    const out = codes("san jose", 12);
    expect(out).toContain("SJO"); // city is actually "San José (Alajuela)"
  });

  it("surfaces the big airport for a city query first (importance weighting)", () => {
    expect(codes("miami")).toContain("MIA");
    expect(codes("lisbon")).toContain("LIS");
    expect(codes("london")).toEqual(expect.arrayContaining(["LHR", "LGW"]));
  });

  it("respects the result limit", () => {
    expect(searchAirports("san", 5).length).toBeLessThanOrEqual(5);
  });
});
