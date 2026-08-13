// app/api/explain/route.js
// The ONLY place Claude is called. Runs on the server — the API key never reaches the browser.
import { getFlights } from "@/lib/flight-source";
import { detectRisks, reconcileVerdict } from "@/lib/flight-helpers";
import { getComparison } from "@/lib/anthropic";

// Defensive: a model slip can leak an internal id (fw_serp_rt_1) into prose Claude
// writes. The prompt forbids it, but trust is the product — never let one reach the
// UI. Strip the id plus any now-orphaned parens/whitespace/punctuation it leaves.
function stripInternalIds(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/\s*\(\s*fw_[a-z0-9_]+\s*\)/gi, "") // "(fw_serp_rt_1)"
    .replace(/\s*\bfw_[a-z0-9_]+\b/gi, "")        // bare "fw_serp_rt_1"
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

// This route STREAMS. A live round-trip search runs two deep SerpApi calls and
// then a Claude call, which can take half a minute, and a page that shows nothing
// for thirty seconds reads as broken. So instead of computing everything and
// replying once at the end, we hold the connection open and write one small JSON
// line per event as it happens. The browser reads those lines as they arrive.
//
// The format is NDJSON: one JSON object per line, newline-separated. Every line
// is one of three things:
//   { "stage": "flights" | "returns" | "read" }  a phase actually just began
//   { "error": "..." }                           an honest down-state
//   { "done": true, ...payload }                 the finished result
//
// Every stage line is written when that phase truly starts, never on a timer and
// never predicted. The wait is real, so the report of it is too.
//
// One consequence worth knowing: an HTTP status is sent with the first byte, so
// once the stream is open we can no longer answer 502. Failures therefore travel
// as an `error` line inside a 200 response, and the client treats that line
// exactly as it used to treat a non-OK status.
export async function POST(request) {
  const search = await request.json();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      // 1) Get the flights. Source is SerpApi in production (FAREWISE_DATA_SOURCE).
      // We only ever reason over THIS data — nothing invented. On ANY failure or an
      // empty result we DO NOT fall back to demo/fake data: we send an honest
      // down-state. FareWise would rather show nothing than fares it can't verify.
      send({ stage: "flights" });
      let flights;
      let priceInsights = null;
      let source = "serpapi";
      try {
        // getFlights reports "returns" itself, from inside the round-trip path,
        // the moment the outbound call lands and the return call goes out.
        ({ flights, priceInsights, source } = await getFlights(search, (stage) => send({ stage })));
      } catch (err) {
        console.error("flight source error:", err);
        send({
          error:
            "We couldn't pull up verified fares for this search right now. FareWise won't show prices it can't stand behind. Please try again in a moment.",
        });
        controller.close();
        return;
      }

      // Genuine empty result (SerpApi returned successfully but no flights for these
      // dates): a calm empty-state, NOT the red error. Skip the AI layer entirely.
      if (!flights || flights.length === 0) {
        send({
          done: true,
          flights: [],
          riskMap: {},
          summary: "",
          verdicts: {},
          priceInsights,
          source,
          search: {
            origin: search.origin,
            destination: search.destination,
            depart: search.depart,
            returnDate: search.returnDate || "",
          },
        });
        controller.close();
        return;
      }

      // Deterministic honesty flags, computed in code (not left to the AI).
      // The 2nd arg (all flights) is intentional — it lets detectRisks spot a
      // possible mistake fare by comparing each price against the others.
      const riskMap = {};
      for (const f of flights) riskMap[f.id] = detectRisks(f, flights);

      // Echo the searched context so the client can request booking options later
      // with the EXACT search that produced these results (not a since-edited form).
      const searchContext = {
        origin: search.origin,
        destination: search.destination,
        depart: search.depart,
        returnDate: search.returnDate || "", // present -> booking uses the round-trip path
        // Carry the party + cabin so "How to book" prices booking options for the
        // same travelers/cabin as the results — not SerpApi's 1-adult, economy default.
        cabin: search.cabin,
        adults: search.adults,
        children: search.children,
        infantsInSeat: search.infantsInSeat,
        infantsOnLap: search.infantsOnLap,
      };

      // The fares are verified and the risk flags are computed, so send them now
      // rather than holding real prices behind a model call that takes another
      // half minute. The cards and their warnings render immediately; the read
      // arrives in the `done` line below and replaces this payload wholesale.
      send({
        results: {
          flights,
          riskMap,
          summary: "",
          verdicts: {},
          priceInsights,
          source,
          search: searchContext,
        },
      });

      // 2) Explain. A failure here is different: we HAVE real flights, the AI layer
      // just didn't respond. Say so honestly, separately from a data outage.
      send({ stage: "read" });
      try {
        // ONE Claude call: summary + per-flight verdict tags + explanations.
        // priceInsights (per-search, real or null) lets Claude ground its read.
        const result = await getComparison(flights, search, riskMap, priceInsights);

        // Map Claude's per-flight output by id, and clamp each verdict against OUR flags
        // so a model slip can only make a card more cautious, never hide a risk.
        const verdicts = {};
        for (const item of result.flights || []) {
          verdicts[item.id] = {
            verdict: reconcileVerdict(item.verdict, riskMap[item.id] || []),
            tag: stripInternalIds(item.tag),
            explanation: stripInternalIds(item.explanation),
          };
        }

        // The same payload the client already has, plus the read. Sent whole
        // rather than as a patch so the client replaces rather than merges,
        // and the two can never drift apart.
        send({
          done: true,
          flights,
          riskMap,
          summary: stripInternalIds(result.summary),
          verdicts,
          priceInsights,
          source,
          search: searchContext,
        });
      } catch (err) {
        console.error("explain route error:", err);
        send({
          error:
            "We found flights but couldn't generate the plain-language read just now. Try again in a moment.",
        });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      // Tells any proxy in front of us not to hold the lines back and deliver
      // them in one lump, which would defeat the whole point.
      "X-Accel-Buffering": "no",
    },
  });
}
