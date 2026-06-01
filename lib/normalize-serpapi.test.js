import { describe, it, expect } from "vitest";
import {
  normalizeSerpFlight,
  normalizeSerpApi,
  normalizeRoundTrip,
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

describe("normalizeRoundTrip", () => {
  const outbound = {
    total_duration: 750,
    layovers: [{ duration: 95 }],
    flights: [
      { departure_airport: { id: "MIA", time: "2026-07-10 19:40" }, arrival_airport: { id: "ZRH", time: "2026-07-11 10:15" }, airline: "Swiss", flight_number: "LX 65", duration: 520 },
      { departure_airport: { id: "ZRH", time: "2026-07-11 11:50" }, arrival_airport: { id: "BER", time: "2026-07-11 12:45" }, airline: "Swiss", flight_number: "LX 962", duration: 95 },
    ],
  };
  const returnsJson = {
    best_flights: [],
    other_flights: [
      {
        total_duration: 700,
        price: 1074,
        booking_token: "BTOK_A",
        flights: [
          { departure_airport: { id: "BER", time: "2026-07-20 20:40" }, arrival_airport: { id: "MIA", time: "2026-07-21 13:00" }, airline: "Swiss", flight_number: "LX 17", duration: 700 },
        ],
      },
      {
        total_duration: 760,
        price: 1240,
        booking_token: "BTOK_B",
        flights: [
          { departure_airport: { id: "BER", time: "2026-07-20 06:00" }, arrival_airport: { id: "MIA", time: "2026-07-20 19:40" }, airline: "Lufthansa", flight_number: "LH 9", duration: 760 },
        ],
      },
    ],
  };

  const list = normalizeRoundTrip(outbound, returnsJson, { cabin: "economy" });

  it("pairs the one outbound with each return option", () => {
    expect(list).toHaveLength(2);
    expect(list[0].tripType).toBe("round-trip");
    expect(list.map((f) => f.id)).toEqual(["fw_serp_rt_0", "fw_serp_rt_1"]);
  });

  it("keeps the outbound in `segments` and the return in `returnSegments`", () => {
    expect(list[0].segments.map((s) => `${s.from}-${s.to}`)).toEqual(["MIA-ZRH", "ZRH-BER"]);
    expect(list[0].stops).toBe(1);
    expect(list[0].returnSegments.map((s) => `${s.from}-${s.to}`)).toEqual(["BER-MIA"]);
    expect(list[0].returnStops).toBe(0);
  });

  it("uses the round-trip TOTAL price and the return's both-leg booking_token", () => {
    expect(list[0].price).toBe(1074);
    expect(list[0].bookVia.token).toBe("BTOK_A");
    expect(list[1].price).toBe(1240);
    expect(list[1].bookVia.token).toBe("BTOK_B");
  });

  it("returns [] when there is no outbound — honest empty state", () => {
    expect(normalizeRoundTrip(null, returnsJson, {})).toEqual([]);
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
