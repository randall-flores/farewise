import { describe, it, expect, afterEach } from "vitest";
import { getFlights } from "./flight-source.js";

const search = { origin: "MIA", destination: "BER", depart: "2026-07-10", cabin: "economy" };

describe("getFlights data-source toggle", () => {
  const originalSource = process.env.FAREWISE_DATA_SOURCE;
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    if (originalSource === undefined) delete process.env.FAREWISE_DATA_SOURCE;
    else process.env.FAREWISE_DATA_SOURCE = originalSource;
    process.env.NODE_ENV = originalEnv;
  });

  it("serves the hand-written demo flights when FAREWISE_DATA_SOURCE=demo (dev)", async () => {
    process.env.FAREWISE_DATA_SOURCE = "demo";
    process.env.NODE_ENV = "development";
    const flights = await getFlights(search);
    expect(flights.length).toBeGreaterThan(0);
    expect(flights[0].id).toMatch(/^fw_/); // demo ids
  });

  it("REFUSES demo data in production — never serves data we can't verify", async () => {
    process.env.FAREWISE_DATA_SOURCE = "demo";
    process.env.NODE_ENV = "production";
    await expect(getFlights(search)).rejects.toThrow(/local-development-only/);
  });
});
