import { describe, it, expect } from "vitest";
import {
  normalizeSerpFlight,
  normalizeSerpApi,
  normalizePriceInsights,
  normalizeBookingOption,
  normalizeBookingOptions,
} from "./normalize-serpapi.js";
import sample from "./serpapi-sample.json";

const search = { origin: "MIA", destination: "BER", depart: "2026-07-10", cabin: "economy" };

describe("normalizeSerpFlight — TAP 1-stop", () => {
  const f = normalizeSerpFlight(sample.best_flights[0], 0, search);

  it("keys the id by position, prices as a rounded int in USD", () => {
    expect(f.id).toBe("fw_serp_0");
    expect(f.price).toBe(452);
    expect(f.currency).toBe("USD");
    expect(f.cabin).toBe("economy");
  });

  it("maps both segments, converting SerpApi times to ISO-ish strings", () => {
    expect(f.segments).toHaveLength(2);
    expect(f.segments[0]).toEqual({
      from: "MIA",
      to: "LIS",
      airline: "TAP Air Portugal",
      flightNo: "TP 202",
      depart: "2026-07-10T18:40",
      arrive: "2026-07-11T07:10",
      duration: "7h 30m",
    });
    expect(f.segments[1].flightNo).toBe("TP 534");
  });

  it("derives stops, total duration, and the first layover", () => {
    expect(f.stops).toBe(1);
    expect(f.totalDuration).toBe("12h 30m");
    expect(f.layover).toBe("1h 50m");
  });

  it("leaves booking type and protection UNKNOWN — search data can't prove either", () => {
    expect(f.bookingType).toBeNull();
    expect(f.protected).toBeNull();
  });

  it("marks fees, baggage, and refundability UNKNOWN — never invented", () => {
    expect(f.extraFees).toEqual({});
    expect(f.feesKnown).toBe(false);
    expect(f.baggage).toEqual({ carryOn: null, checked: null });
    expect(f.refundable).toBeNull();
  });

  it("lists ONLY the searched cabin", () => {
    expect(f.cabinOptions).toEqual([{ cabin: "economy", price: 452 }]);
  });

  it("does NOT fetch a booking link; keeps the booking_token for later", () => {
    expect(f.bookVia.url).toBeNull();
    expect(f.bookVia.name).toBe("TAP Air Portugal");
    expect(f.bookVia.token).toBe("WyJDalJJVEFTAMPLE_TAP");
  });
});

describe("normalizeSerpFlight — Lufthansa nonstop", () => {
  const f = normalizeSerpFlight(sample.best_flights[1], 1, search);

  it("has no stops and an empty layover", () => {
    expect(f.stops).toBe(0);
    expect(f.layover).toBe("");
    expect(f.totalDuration).toBe("9h 55m");
  });
});

describe("normalizeSerpApi", () => {
  it("normalizes best_flights then other_flights, preserving order", () => {
    const list = normalizeSerpApi(sample, search);
    expect(list.map((f) => f.id)).toEqual(["fw_serp_0", "fw_serp_1"]);
  });

  it("returns [] for an empty response (caller turns this into an honest error)", () => {
    expect(normalizeSerpApi({}, search)).toEqual([]);
    expect(normalizeSerpApi({ best_flights: [], other_flights: [] }, search)).toEqual([]);
  });

  it("drops items without a verifiable numeric price", () => {
    const dirty = { best_flights: [{ flights: [], price: null }, { flights: [], price: 300 }] };
    const list = normalizeSerpApi(dirty, search);
    expect(list).toHaveLength(1);
    expect(list[0].price).toBe(300);
  });
});

describe("normalizePriceInsights", () => {
  it("passes through level, lowest price, and the typical range", () => {
    expect(normalizePriceInsights(sample)).toEqual({
      lowestPrice: 452,
      priceLevel: "typical",
      typicalPriceRange: [430, 760],
    });
  });

  it("returns null when price_insights is absent — asserts nothing", () => {
    expect(normalizePriceInsights({})).toBeNull();
  });

  it("ignores an unrecognized price_level and a malformed range", () => {
    const pi = normalizePriceInsights({ price_insights: { price_level: "cheap", typical_price_range: [100] } });
    expect(pi).toBeNull();
  });
});

describe("normalizeBookingOption", () => {
  it("maps an airline-direct option (airline === true)", () => {
    const o = normalizeBookingOption({
      together: {
        book_with: "British Airways",
        airline: true,
        price: 527,
        baggage_prices: ["1 free carry-on"],
        booking_request: { url: "https://www.google.com/travel/clk/f", post_data: "u=ABC123" },
      },
    });
    expect(o).toMatchObject({
      seller: "British Airways",
      isAirlineDirect: true,
      price: 527,
      ticketKind: "together",
      baggagePrices: ["1 free carry-on"],
      redirect: { url: "https://www.google.com/travel/clk/f", postData: "u=ABC123" },
    });
    expect(o.fareConditions).toEqual([]); // absent -> [], never invented
    expect(o.optionTitle).toBeNull();
  });

  it("treats a third party (airline absent) as NOT direct", () => {
    const o = normalizeBookingOption({ together: { book_with: "FlightHub", price: 532 } });
    expect(o.isAirlineDirect).toBe(false);
    expect(o.seller).toBe("FlightHub");
    expect(o.redirect).toBeNull(); // no booking_request -> no fabricated link
  });

  it("flags separate tickets and keeps fare conditions when present", () => {
    const o = normalizeBookingOption({
      separate: {
        book_with: "Kiwi.com",
        price: 410,
        option_title: "Saver",
        extensions: ["No refunds", "Change fee applies"],
        booking_request: { url: "https://x", post_data: "u=ZZZ" },
      },
    });
    expect(o.ticketKind).toBe("separate");
    expect(o.optionTitle).toBe("Saver");
    expect(o.fareConditions).toEqual(["No refunds", "Change fee applies"]);
  });
});

describe("normalizeBookingOptions", () => {
  it("normalizes the list cheapest-first, dropping empty entries", () => {
    const list = normalizeBookingOptions({
      booking_options: [
        { together: { book_with: "B", price: 532 } },
        {}, // no together/separate -> dropped
        { together: { book_with: "A", price: 410 } },
      ],
    });
    expect(list.map((o) => o.price)).toEqual([410, 532]);
  });

  it("returns [] when there are no booking_options — honest empty state", () => {
    expect(normalizeBookingOptions({})).toEqual([]);
  });
});
