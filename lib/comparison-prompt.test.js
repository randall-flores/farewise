import { describe, it, expect } from "vitest";
import { COMPARISON_TOOL, buildComparisonPrompt } from "./comparison-prompt.js";

describe("COMPARISON_TOOL", () => {
  it("is named present_comparison", () => {
    expect(COMPARISON_TOOL.name).toBe("present_comparison");
  });

  it("locks verdict to exactly the three allowed values", () => {
    const enumValues =
      COMPARISON_TOOL.input_schema.properties.flights.items.properties.verdict.enum;
    expect(enumValues).toEqual(["good", "caution", "high-risk"]);
  });

  it("requires summary and flights at the top level", () => {
    expect(COMPARISON_TOOL.input_schema.required).toEqual(["summary", "flights"]);
  });

  it("requires id, verdict, tag, explanation on each flight", () => {
    expect(COMPARISON_TOOL.input_schema.properties.flights.items.required).toEqual([
      "id", "verdict", "tag", "explanation",
    ]);
  });
});

describe("buildComparisonPrompt", () => {
  const flights = [{ id: "fw_001" }, { id: "fw_002" }];
  const search = { origin: "MIA", destination: "BER", depart: "2026-07-10", returnDate: "", cabin: "economy" };
  const riskMap = { fw_001: [], fw_002: [] };

  it("lists every flight id so Claude returns one entry per flight", () => {
    const text = buildComparisonPrompt(flights, search, riskMap);
    expect(text).toContain("fw_001");
    expect(text).toContain("fw_002");
    expect(text).toContain("EXACTLY one entry");
  });

  it("includes the search and instructs calling the tool", () => {
    const text = buildComparisonPrompt(flights, search, riskMap);
    expect(text).toContain("MIA -> BER");
    expect(text).toContain("present_comparison");
  });
});
