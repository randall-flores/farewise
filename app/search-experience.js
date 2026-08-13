"use client";
import { useState, useEffect, useRef } from "react";
import { formatMoney, totalExtraFees, allInPrice } from "@/lib/flight-helpers";
import { searchAirports, loadAirports } from "@/lib/airport-search";
import { PASSENGER_DEFAULTS, passengerSummary, adjust, canIncrement, canDecrement } from "@/lib/passengers";
import styles from "./page.module.css";

// True when the user asked the OS to reduce motion. Every animated piece below
// reads this and falls back to an instant, final state. (globals.css also kills
// CSS animation globally under the same query — this is the JS-side guard.)
function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduce;
}

// Belt-and-suspenders: the generation prompt forbids em dashes, but if one ever
// slips through we never render it. Turn an em dash (or "--") into a comma break
// so the plain-spoken voice holds in the UI too.
function noEmDash(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s*--\s*/g, ", ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// The one chevron in the app, on both disclosure buttons. It points down when
// the panel is shut and flips when it opens — the flip is driven purely by the
// button's own aria-expanded, so each toggle always shows its own state.
function Chevron() {
  return (
    <svg
      className={styles.chev}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

// A From/To field with debounced airport/city autocomplete.
// Shows what the user types; commits the chosen IATA code to the parent form.
function AirportField({ label, name, initial, initialCommitted, onSelect }) {
  const [text, setText] = useState(initial); // what's visible in the box
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1); // highlighted suggestion for arrow-key nav
  const [invalid, setInvalid] = useState(false); // typed something but never picked a real place
  const blurTimer = useRef(null);
  // `initial` is a LABEL (display text), not proof of a real pick — the parent
  // also tracks uncommitted, partially-typed text as a label (see onChange
  // below) so a swap can restore it. Only the caller's `initialCommitted`
  // (derived from whether the parent's CODE is set) says whether this field
  // actually holds a real, chosen place.
  const committed = useRef(Boolean(initialCommitted));
  const errorId = `${name}-error`;

  // Local, instant autocomplete over the bundled airport dataset — no network,
  // no API key, no per-keystroke quota. (Was a debounced /api/places fetch.)
  function runSearch(value) {
    const matches = searchAirports(value);
    setResults(matches);
    setOpen(matches.length > 0);
    setActive(-1);
  }

  // Keep the arrow-key-highlighted option visible inside the scrollable dropdown.
  // "nearest" only scrolls when it's actually off-screen, and stays within the list.
  useEffect(() => {
    if (active < 0) return;
    const el = document.getElementById(`${name}-opt-${active}`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [active, name]);

  function onChange(e) {
    const value = e.target.value;
    setText(value);
    setInvalid(false); // clear the error while they're still typing
    // Let power users type a raw 3-letter code directly (e.g. "JFK"). The parent
    // needs the label too (not just the code) so a later swap can restore this
    // box's visible text — the label is just whatever's currently typed.
    const code = value.trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(code)) {
      committed.current = true;
      onSelect(code, value);
    } else {
      committed.current = false; // edited text no longer matches a chosen place
      onSelect("", value); // no valid code right now, but track what's actually in the box
    }
    if (value.trim().length >= 2) {
      // The airport dataset loads once on first use; after that this resolves
      // synchronously-fast and runSearch filters in memory.
      loadAirports().then(() => runSearch(value));
    } else {
      setResults([]);
      setOpen(false);
      setActive(-1);
    }
  }

  function choose(place) {
    committed.current = true;
    onSelect(place.code, place.label); // parent stores both the code (search) and label (display)
    setText(place.label); // the box shows the friendly label, e.g. "Berlin (BER), Brandenburg"
    setResults([]);
    setActive(-1);
    setOpen(false);
    setInvalid(false);
    clearTimeout(blurTimer.current);
  }

  // Keyboard: arrow up/down move the highlight, Enter picks it, Escape closes.
  function onKeyDown(e) {
    if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (e.key === "ArrowDown") {
      if (!open && results.length) {
        setOpen(true);
        return;
      }
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter" && open && active >= 0 && results[active]) {
      e.preventDefault(); // pick the highlighted suggestion instead of submitting
      choose(results[active]);
    }
  }

  return (
    <label className={styles.field}>
      <span className={styles.fieldKey}>{label}</span>
      <div className={styles.autocomplete}>
        <input
          className={styles.fieldInput}
          name={name}
          value={text}
          onChange={onChange}
          onFocus={() => {
            clearTimeout(blurTimer.current);
            loadAirports(); // warm the dataset before the user types
            if (results.length) setOpen(true);
          }}
          onBlur={() => {
            // Delay so a click on a suggestion still registers before we close
            // and judge validity. A pick cancels this timer.
            blurTimer.current = setTimeout(() => {
              setOpen(false);
              setInvalid(text.trim() !== "" && !committed.current);
            }, 120);
          }}
          onKeyDown={onKeyDown}
          placeholder="City or airport"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${name}-listbox`}
          aria-activedescendant={active >= 0 ? `${name}-opt-${active}` : undefined}
          aria-autocomplete="list"
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          required
        />
        {open && results.length > 0 && (
          <ul className={styles.suggestions} id={`${name}-listbox`} role="listbox">
            {results.map((p, i) => (
              <li key={`${p.type}-${p.code}-${p.label}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  id={`${name}-opt-${i}`}
                  className={`${styles.suggestion} ${p.type === "city" ? styles.suggestionCity : ""} ${
                    p.underCity ? styles.suggestionUnderCity : ""
                  } ${i === active ? styles.suggestionActive : ""}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(p)}
                >
                  {p.label}
                  <span className={styles.suggestionType}>{p.country || p.type}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {invalid && (
        <span className={styles.fieldError} id={errorId} role="alert">
          Pick a city or airport from the list.
        </span>
      )}
    </label>
  );
}

const CABIN_LABEL = { economy: "Economy", premium: "Premium economy", business: "Business", first: "First class" };

// Build the route line ("MIA → LIS → BER") from the segments. The arrow reads
// as "then", the same as it does between the two clock times beside it.
function routeCodes(segments = []) {
  const first = segments[0]?.from;
  const rest = segments.map((s) => s.to);
  return [first, ...rest].filter(Boolean).join(" → ");
}

// One leg as two record rows: where it goes and when (mono, so the digits line
// up down the card), then the shape of the journey. `label`
// ("Outbound"/"Return") only appears on round trips, where the user genuinely
// has two legs to tell apart — and it carries that leg's airline, since the two
// directions can be flown by different ones.
function LegLine({ segments, stops, totalDuration, label }) {
  if (!segments?.length) return null;
  const dep = clockTime(segments[0]?.depart);
  const arr = clockTime(segments[segments.length - 1]?.arrive);
  const off = dayOffset(segments[0]?.depart, segments[segments.length - 1]?.arrive);
  const date = shortDate(segments[0]?.depart);
  const shape = [
    stops === 0 ? "no stops" : `${stops} stop${stops === 1 ? "" : "s"}`,
    totalDuration,
    label && segments[0]?.airline ? segments[0].airline : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <div className={styles.rw}>
        <span className={styles.rwKey}>
          {label ? `${label}${date ? ` · ${date}` : ""}` : "Route"}
        </span>
        <span className={`${styles.rwVal} ${styles.mono}`}>
          {routeCodes(segments)}
          {dep && arr && (
            <>
              <span className={styles.rwSep}> </span>
              {dep} → {arr}
              {off > 0 && (
                <span
                  className={styles.dayOffset}
                  aria-label={off === 1 ? "arrives the next day" : `arrives ${off} days later`}
                >
                  +{off}
                </span>
              )}
            </>
          )}
        </span>
      </div>
      <div className={styles.rw}>
        <span className={styles.rwKey}>Stops</span>
        <span className={styles.rwVal}>{shape}</span>
      </div>
    </>
  );
}

// On-brand price-context line from SerpApi price_insights (real, per search), or
// null. Honest: if a piece is missing we just don't say it.
function priceInsightLine(pi) {
  if (!pi) return null;
  const money = (n) => formatMoney(n, "USD");
  const range = pi.typicalPriceRange;
  if (pi.priceLevel && range) {
    return `Prices for this route are currently ${pi.priceLevel}. Typical range ${money(range[0])} to ${money(range[1])}.`;
  }
  if (pi.priceLevel) return `Prices for this route are currently ${pi.priceLevel}.`;
  if (range) return `Typical price for this route: ${money(range[0])} to ${money(range[1])}.`;
  return null;
}

// "2026-07-10T18:40" -> "18:40". Times are local wall-clock at each airport; we
// read the string, never new Date() (which would shift by the browser's zone).
function clockTime(iso) {
  if (!iso) return "";
  return (String(iso).split("T")[1] || "").slice(0, 5);
}

// "2026-07-10T18:40" -> "Jul 10" (the leg's date, useful on round trips).
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function shortDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}` : "";
}

// Whole-calendar-day difference between departure and arrival, from the DATE
// parts only (Date.UTC avoids any timezone shift). 0 = same day, 1 = next day,
// etc. Honesty: this is what powers the "+1" so we never imply same-day arrival.
function dayOffset(departIso, arriveIso) {
  const d = String(departIso || "").split("T")[0];
  const a = String(arriveIso || "").split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{4}-\d{2}-\d{2}$/.test(a)) return 0;
  const [y1, m1, d1] = d.split("-").map(Number);
  const [y2, m2, d2] = a.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

// Whole nights between depart and return (both YYYY-MM-DD), or null when there's
// no valid positive span: one-way (no return), same-day return, return before
// departure, or a missing/invalid date. Returning null means the caller omits the
// segment entirely — never "0 nights" or "NaN". UTC date math avoids any timezone
// shift, same as dayOffset.
function nightsBetween(depart, returnDate) {
  const d = String(depart || "").split("T")[0];
  const r = String(returnDate || "").split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{4}-\d{2}-\d{2}$/.test(r)) return null;
  const [y1, m1, d1] = d.split("-").map(Number);
  const [y2, m2, d2] = r.split("-").map(Number);
  const nights = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
  return nights > 0 ? nights : null;
}

// Render one honest-read line with the airline (bold) and price (mono) pulled
// out as an emphasized lead-in. We key off the REAL data (the flights' airline
// names + a $ token), not a fixed prose template, so the wording can vary freely
// and we still emphasize the two things people scan for. Weight and the mono
// face do the emphasis, not colour. Falls back to plain text when nothing matches.
function renderHonestLine(line, flights) {
  const nodes = [];
  let rest = line;

  // Bold a leading airline name (try longest first so "Air France" beats "Air").
  const names = (flights || [])
    .map((f) => f.bookVia?.name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const n of names) {
    if (rest.toLowerCase().startsWith(n.toLowerCase())) {
      nodes.push(
        <b key="airline" className={styles.leadAirline}>
          {rest.slice(0, n.length)}
        </b>
      );
      rest = rest.slice(n.length);
      break;
    }
  }

  // Mono the first price token (e.g. "$420" or "~$467").
  const m = rest.match(/~?\$[\d,]+/);
  if (m) {
    nodes.push(rest.slice(0, m.index));
    nodes.push(
      <span key="price" className={styles.leadPrice}>
        {m[0]}
      </span>
    );
    nodes.push(rest.slice(m.index + m[0].length));
  } else {
    nodes.push(rest);
  }
  return nodes;
}

// The booking redirect is a POST (Google's clk endpoint + post_data), not a GET
// URL. Build a real form, decode each post_data field (the browser re-encodes on
// submit so it matches the original), and open the result in a new tab. A plain
// <a href> does NOT work here.
function BookForm({ redirect, label }) {
  if (!redirect?.url || !redirect?.postData) return null;
  const fields = redirect.postData.split("&").map((pair) => {
    const i = pair.indexOf("=");
    const key = i === -1 ? pair : pair.slice(0, i);
    let val = "";
    try {
      val = i === -1 ? "" : decodeURIComponent(pair.slice(i + 1));
    } catch {
      val = pair.slice(i + 1);
    }
    return [key, val];
  });
  return (
    <form action={redirect.url} method="POST" target="_blank" className={styles.bookForm}>
      {fields.map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" className={styles.bookGo}>
        {label} ↗
      </button>
    </form>
  );
}

// Lazy "How to book": fetches real booking options ONLY when expanded (never on
// results-page load). Honest states: loading, error, and a no-options message —
// never a fabricated link or price.
function BookOptions({ token, search }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [options, setOptions] = useState(null); // null = not fetched yet

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/book-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          departure_id: search?.origin,
          arrival_id: search?.destination,
          outbound_date: search?.depart,
          return_date: search?.returnDate || "", // round trip -> link covers both legs
          cabin: search?.cabin,
          adults: search?.adults,
          children: search?.children,
          infants_in_seat: search?.infantsInSeat,
          infants_on_lap: search?.infantsOnLap,
        }),
      });
      const json = await res.json();
      if (json.error) setError(json.error);
      else setOptions(json.options || []);
    } catch {
      setError("Couldn't load booking options. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && options === null && !loading) load();
  }

  return (
    <div className={styles.bookWrap}>
      <button type="button" className={styles.bookToggle} onClick={toggle} aria-expanded={open}>
        <span>{open ? "Hide booking options" : "How to book"}</span>
        <Chevron />
      </button>

      {open && (
        <div className={styles.bookPanel}>
          {loading && (
            <p className={styles.bookNote} role="status">
              Loading booking options…
            </p>
          )}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {options && options.length === 0 && !loading && !error && (
            <p className={styles.bookNote}>No booking options are listed for this flight right now.</p>
          )}
          {options && options.length > 0 && (
            <>
              <p className={styles.bookNote}>
                These are live prices from each seller. They can differ from the price above.
              </p>
              <ul className={styles.bookList}>
                {options.map((o, i) => (
                  <li key={i} className={styles.bookOption}>
                    <div className={styles.bookOptionHead}>
                      <span className={styles.bookSeller}>
                        {o.seller}
                        <span
                          className={`${styles.bookTag} ${
                            o.isAirlineDirect ? styles.bookTagDirect : styles.bookTagThird
                          }`}
                        >
                          {o.isAirlineDirect ? "Direct" : "Third party"}
                        </span>
                        {o.optionTitle && <span className={styles.bookFare}>{o.optionTitle}</span>}
                      </span>
                      {o.price != null && (
                        <span className={styles.bookPrice}>{formatMoney(o.price, "USD")}</span>
                      )}
                    </div>

                    {o.ticketKind === "separate" && (
                      <p className={styles.bookWarn}>
                        Separate tickets booked together. If one flight is late, the other airline
                        isn&apos;t obliged to rebook you.
                      </p>
                    )}

                    {o.fareConditions.length > 0 && (
                      <ul className={styles.bookConds}>
                        {o.fareConditions.map((c, j) => (
                          <li key={j}>{c}</li>
                        ))}
                      </ul>
                    )}
                    {o.baggagePrices.length > 0 && (
                      <p className={styles.bookBags}>{o.baggagePrices.join(" · ")}</p>
                    )}

                    {o.redirect ? (
                      <BookForm redirect={o.redirect} label={`Continue to ${o.seller}`} />
                    ) : (
                      <p className={styles.bookNote}>No booking link provided for this option.</p>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// One flight result, rendered as a record: a head (tag, airline, price), then one
// labelled row per fact with the value right-aligned, then the one-line
// judgement, then any warnings — which are ALWAYS visible, never behind the
// toggle. The foot opens the full detail.
function FlightCard({ flight, risks, verdict, search, cheapest = false, index = 0 }) {
  const [open, setOpen] = useState(false);
  const reduce = usePrefersReducedMotion();
  const fees = totalExtraFees(flight);
  const allIn = allInPrice(flight);
  const feesKnown = flight.feesKnown !== false; // false only when the data source didn't itemize fees
  const level = verdict?.verdict ?? "caution";
  const roundTrip = flight.tripType === "round-trip";

  return (
    <article
      className={`${styles.fare} ${open ? styles.open : ""}`}
      style={reduce ? undefined : { animationDelay: `${index * 70}ms` }}
    >
      <div className={styles.fareHead}>
        <div className={styles.fareId}>
          {/* At most one tag. "Check the catch" points at the warning below it;
              "No catch found" says only what we checked, never that the ticket
              is protected — the data source doesn't tell us that. */}
          {level === "high-risk" ? (
            <span className={`${styles.tag} ${styles.tagBad}`}>
              <span className={styles.tagIc} aria-hidden="true">▲</span>
              Check the catch
            </span>
          ) : cheapest ? (
            <span className={`${styles.tag} ${styles.tagPick}`}>Cheapest</span>
          ) : level === "good" ? (
            <span className={`${styles.tag} ${styles.tagOk}`}>
              <span className={styles.tagIc} aria-hidden="true">✓</span>
              No catch found
            </span>
          ) : null}
          <h2 className={styles.airline}>{flight.bookVia.name}</h2>
        </div>
        <p className={styles.amt}>
          <span className={styles.mono}>{formatMoney(flight.price, flight.currency)}</span>
          <small>{roundTrip ? "round trip" : "one way"}</small>
        </p>
      </div>

      <div className={styles.rows}>
        {roundTrip ? (
          <>
            <LegLine
              segments={flight.segments}
              stops={flight.stops}
              totalDuration={flight.totalDuration}
              label="Outbound"
            />
            <LegLine
              segments={flight.returnSegments}
              stops={flight.returnStops}
              totalDuration={flight.returnTotalDuration}
              label="Return"
            />
          </>
        ) : (
          <LegLine
            segments={flight.segments}
            stops={flight.stops}
            totalDuration={flight.totalDuration}
          />
        )}
        <div className={styles.rw}>
          <span className={styles.rwKey}>Total cost</span>
          <span className={styles.rwVal}>
            {!feesKnown ? (
              "fare only · fees not listed"
            ) : fees > 0 ? (
              <>
                <span className={styles.mono}>~{formatMoney(allIn, flight.currency)}</span> with
                bag and seat
              </>
            ) : (
              "no extra fees listed"
            )}
          </span>
        </div>
      </div>

      {/* The one-line judgement. */}
      {verdict?.tag && <p className={styles.say}>{noEmDash(verdict.tag)}</p>}

      {/* Deterministic, from code, not from the model. Colour is never the only
          signal — the icon and the word carry it too. */}
      {risks.length > 0 && (
        <div className={styles.warnings}>
          {risks.map((r, i) => (
            <div key={i} className={`${styles.warn} ${styles[`warn_${r.severity}`]}`}>
              <p className={styles.warnLbl}>
                <span aria-hidden="true">{r.severity === "info" ? "i" : "▲"}</span>
                {r.severity === "info" ? "Note" : "Warning"}
              </p>
              <p className={styles.warnMsg}>{r.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* ---- The detail, opened on demand: every flight in order, the full
              reasoning, then how to actually book it. ---- */}
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>{open ? "Hide the detail" : "See every flight and fee"}</span>
        <Chevron />
      </button>

      <div className={styles.detail}>
        <div className={styles.detailInner}>
          <div className={styles.detailPad}>
            {/* Each flight on its own line, in the order they're flown. On a
                round trip the two directions are separate lists so the
                numbering restarts where the journey does. */}
            {roundTrip && <p className={styles.stopsHead}>Outbound</p>}
            <ol className={styles.stops}>
              {flight.segments.map((s, i) => (
                <li key={`o${i}`} className={styles.stop}>
                  <span className={styles.stopT}>
                    <span className={styles.mono}>{clockTime(s.depart)}</span> {s.from} → {s.to}
                  </span>
                  <span className={styles.stopP}>
                    {s.airline} {s.flightNo} · {s.duration}
                  </span>
                </li>
              ))}
            </ol>
            {roundTrip && flight.returnSegments?.length > 0 && (
              <>
                <p className={styles.stopsHead}>Return</p>
                <ol className={styles.stops}>
                  {flight.returnSegments.map((s, i) => (
                    <li key={`r${i}`} className={styles.stop}>
                      <span className={styles.stopT}>
                        <span className={styles.mono}>{clockTime(s.depart)}</span> {s.from} → {s.to}
                      </span>
                      <span className={styles.stopP}>
                        {s.airline} {s.flightNo} · {s.duration}
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            )}
            {verdict?.explanation ? (
              noEmDash(verdict.explanation)
                .split("\n")
                .filter(Boolean)
                .map((p, i) => <p key={i}>{p}</p>)
            ) : (
              <p>No further detail available.</p>
            )}
            {flight.bookVia?.token ? (
              // Real source: lazy-fetch booking options on demand (not on load).
              <BookOptions token={flight.bookVia.token} search={search} />
            ) : flight.bookVia?.url ? (
              // Demo data carries a placeholder link.
              <a
                className={styles.book}
                href={flight.bookVia.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Book direct with {flight.bookVia.name} ↗
              </a>
            ) : (
              <p className={styles.bookSoon}>No booking link for this option yet.</p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

// The phases of a search, in the order they run. Each one is reported by the
// server the moment it actually begins, so this list is a record of what has
// happened, never a guess at how far along we are. There is no progress bar for
// the same reason: we don't know how long SerpApi will take, and inventing a
// percentage would be the one kind of dishonesty this product exists to avoid.
const SEARCH_STAGES = [
  { id: "flights", label: "Searching flights" },
  { id: "returns", label: "Checking return flights", roundTripOnly: true },
  { id: "read", label: "Reading the fine print" },
];

function SearchProgress({ stage, roundTrip }) {
  const steps = SEARCH_STAGES.filter((s) => roundTrip || !s.roundTripOnly);
  // Before the first line arrives, the first step is already underway — the
  // server sends it immediately, so treating it as active is true, not optimistic.
  const currentIndex = Math.max(
    0,
    steps.findIndex((s) => s.id === stage)
  );
  const current = steps[currentIndex];

  return (
    <div className={styles.progress}>
      {/* One polite announcement per change. The list below is the visual
          version of the same thing, so screen readers hear it once, not twice. */}
      <p className={styles.srOnly} role="status" aria-live="polite">
        {current.label}
      </p>
      <ol className={styles.stages} aria-hidden="true">
        {steps.map((s, i) => {
          const state = i < currentIndex ? "done" : i === currentIndex ? "active" : "waiting";
          return (
            <li key={s.id} className={styles.stageRow} data-state={state}>
              <span className={styles.stageMark}>
                {state === "done" ? (
                  "✓"
                ) : state === "active" ? (
                  <span className={styles.working}>
                    <i />
                    <i />
                    <i />
                  </span>
                ) : (
                  "·"
                )}
              </span>
              {s.label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Travelers selector: a button showing the party summary that opens a popover of
// four counter rows. Controlled — counts live in the parent form state; this owns
// only the open/closed state. All count rules live in lib/passengers (adjust /
// canIncrement / canDecrement), so the buttons just call them.
const TRAVELER_ROWS = [
  { type: "adults", label: "Adults" },
  { type: "children", label: "Children", hint: "2 to 11" },
  { type: "infantsInSeat", label: "Infants in seat" },
  { type: "infantsOnLap", label: "Infants on lap" },
];

function TravelersControl({ counts, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close on click/tap outside the popover, and on Escape.
  useEffect(() => {
    if (!open) return;
    function onDocPointer(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const summary = passengerSummary(counts);

  return (
    <div className={styles.travelersWrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.travelers}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Travelers: ${summary}`}
        onClick={() => setOpen((o) => !o)}
      >
        <svg className={styles.travelersIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span className={styles.travelersCount}>{summary}</span>
        <svg className={styles.travelersChev} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className={styles.travelersPanel} role="dialog" aria-label="Travelers">
          {TRAVELER_ROWS.map((r) => (
            <div key={r.type} className={styles.counterRow}>
              <div className={styles.counterLabel}>
                {r.label}
                {r.hint && <span className={styles.counterHint}>{r.hint}</span>}
              </div>
              <div className={styles.counter}>
                <button
                  type="button"
                  className={styles.counterBtn}
                  onClick={() => onChange(adjust(counts, r.type, -1))}
                  disabled={!canDecrement(counts, r.type)}
                  aria-label={`Remove one ${r.label.toLowerCase()}`}
                >
                  −
                </button>
                <span className={styles.counterValue}>{counts[r.type]}</span>
                <button
                  type="button"
                  className={styles.counterBtn}
                  onClick={() => onChange(adjust(counts, r.type, 1))}
                  disabled={!canIncrement(counts, r.type)}
                  aria-label={`Add one ${r.label.toLowerCase()}`}
                >
                  +
                </button>
              </div>
            </div>
          ))}
          <button type="button" className={styles.travelersDone} onClick={() => setOpen(false)}>
            Done
          </button>
        </div>
      )}
    </div>
  );
}

export default function SearchExperience() {
  const [form, setForm] = useState({
    origin: "",
    destination: "",
    // The friendly display label for each field (e.g. "Berlin (BER), Brandenburg"),
    // kept alongside the bare code so a swap can restore the right text in each box —
    // AirportField only knows its own box, not what the other one is showing.
    originLabel: "",
    destinationLabel: "",
    tripType: "round-trip",
    depart: "",
    returnDate: "",
    cabin: "economy",
    ...PASSENGER_DEFAULTS,
  });

  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(null); // which phase the server says it's in
  const [data, setData] = useState(null); // { flights, riskMap, summary, verdicts }
  const [error, setError] = useState(null);
  // True while the user has results but tapped "Edit" to change the search
  // without losing it. Default false: on first load (no results yet) the form
  // is the whole screen anyway, `showForm` below covers that case too.
  const [editing, setEditing] = useState(false);
  // The form (and the h1/lead above it) render only when there's nothing to
  // show yet, or the user explicitly asked to edit — never stacked on top of
  // results by default. See findings 1+2 in the Task 4 review.
  const showForm = editing || !(data || loading);
  // Bumped on reset to remount the autocomplete fields (they hold their own
  // visible text, so clearing form state alone wouldn't empty the boxes).
  const [resetKey, setResetKey] = useState(0);
  // Bumped on swap, same reason as resetKey: remounting the two fields with
  // their new `initial` label is the only way to force the visible text to change.
  const [swapKey, setSwapKey] = useState(0);

  // Today, as YYYY-MM-DD, for the date inputs' `min` and the submit-time guard.
  const today = new Date().toISOString().slice(0, 10);

  // The results screen's heading, focused programmatically the moment fresh
  // results land. Without this, the form (and the Submit button holding
  // focus) unmounts on submit and focus silently falls back to <body> — a
  // keyboard/screen-reader user gets no indication of where they landed.
  const resultsHeadingRef = useRef(null);
  useEffect(() => {
    // Only on the transition INTO results (data going from null to an
    // object), never on every render — editing/resubmitting sets data back
    // to null first, so this fires again exactly when new results appear.
    if (data) resultsHeadingRef.current?.focus();
  }, [data]);

  function update(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  // Trip type drives which date fields show. Switching to One way clears any
  // return date already entered, so a stale return can never reach the search
  // (the field is also hidden, but we clear state too — belt and suspenders).
  function setTripType(tripType) {
    setForm((f) => ({ ...f, tripType, returnDate: tripType === "one-way" ? "" : f.returnDate }));
  }

  // Swap From and To — code AND label together, in one update, so neither box
  // ever shows a code that doesn't match its own displayed text.
  function swapOriginDestination() {
    setForm((f) => ({
      ...f,
      origin: f.destination,
      destination: f.origin,
      originLabel: f.destinationLabel,
      destinationLabel: f.originLabel,
    }));
    setSwapKey((k) => k + 1);
  }

  function resetSearch() {
    setForm({
      origin: "",
      destination: "",
      originLabel: "",
      destinationLabel: "",
      tripType: "round-trip",
      depart: "",
      returnDate: "",
      cabin: "economy",
      ...PASSENGER_DEFAULTS,
    });
    setData(null);
    setError(null);
    setResetKey((k) => k + 1);
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  async function onSubmit(e) {
    e.preventDefault();
    // Both fields must hold a real code (chosen from the list, or a typed 3-letter code).
    if (!form.origin || !form.destination) {
      setError("Pick a city or airport from the suggestions for both From and To.");
      return;
    }
    if (form.depart && form.depart < today) {
      setError("Departure date is in the past. Pick today or a later date.");
      return;
    }
    if (form.returnDate && form.returnDate < form.depart) {
      setError("Return date is before departure. Set a return on or after your departure date.");
      return;
    }
    if (form.tripType === "round-trip" && !form.returnDate) {
      setError("Add a return date, or switch to One way.");
      return;
    }
    setLoading(true);
    setEditing(false); // a resubmit always returns to the results view
    setError(null);
    setData(null);
    setStage(null);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      // The route answers in NDJSON: one JSON object per line, written as each
      // phase actually happens. Read the body as it arrives instead of waiting
      // for the whole thing, so the wait can report itself.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let settled = false; // saw a `done` or `error` line

      // A chunk can split mid-line, so keep the tail in `buffer` until its
      // newline shows up in the next chunk.
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // the last piece may be a partial line
        for (const line of lines) {
          if (!line.trim()) continue;
          let msg;
          try {
            msg = JSON.parse(line);
          } catch {
            continue; // never let one malformed line kill a good search
          }
          if (msg.stage) setStage(msg.stage);
          else if (msg.error) {
            setError(msg.error);
            settled = true;
          } else if (msg.done) {
            setData(msg);
            settled = true;
          }
        }
      }

      // The connection ended without a verdict: the function died mid-flight, or
      // something between us dropped it. Say so rather than sitting on a spinner.
      if (!settled) {
        setError("The search stopped before it finished. Try again in a moment.");
      }
    } catch {
      setError("Couldn't reach FareWise. Check your connection and try again.");
    } finally {
      setLoading(false);
      setStage(null);
    }
  }

  return (
    <>
      {/* App bar — the wordmark and nothing else. This is a tool, not a
          landing page; the search card below is the first real thing. */}
      <header className={styles.appbar}>
        <p className={styles.brand}>
          Fare<span>Wise</span>
        </p>
      </header>

      {showForm && <h1 className={styles.h1}>Where to?</h1>}

      {showForm && (
        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.fields}>
            <AirportField
              key={`origin-${resetKey}-${swapKey}`}
              label="From"
              name="origin"
              initial={form.originLabel}
              initialCommitted={Boolean(form.origin)}
              onSelect={(code, label) => setForm((f) => ({ ...f, origin: code, originLabel: label }))}
            />
            <div className={styles.swap}>
              <button type="button" aria-label="Swap origin and destination" onClick={swapOriginDestination}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M7 4v16M7 20l-3-3M17 20V4M17 4l3 3" />
                </svg>
              </button>
            </div>
            <AirportField
              key={`destination-${resetKey}-${swapKey}`}
              label="To"
              name="destination"
              initial={form.destinationLabel}
              initialCommitted={Boolean(form.destination)}
              onSelect={(code, label) => setForm((f) => ({ ...f, destination: code, destinationLabel: label }))}
            />

            <div className={styles.fieldSplit}>
              <label className={styles.field}>
                <span className={styles.fieldKey}>Out</span>
                <input
                  className={styles.fieldInput}
                  type="date"
                  name="depart"
                  value={form.depart}
                  onChange={update}
                  min={today}
                  required
                />
              </label>
              {form.tripType === "round-trip" && (
                <label className={styles.field}>
                  <span className={styles.fieldKey}>Back</span>
                  <input
                    className={styles.fieldInput}
                    type="date"
                    name="returnDate"
                    value={form.returnDate}
                    onChange={update}
                    min={form.depart || today}
                  />
                </label>
              )}
            </div>

            <div className={styles.fieldRow}>
              <span className={styles.fieldKey}>Who</span>
              <TravelersControl
                counts={{
                  adults: form.adults,
                  children: form.children,
                  infantsInSeat: form.infantsInSeat,
                  infantsOnLap: form.infantsOnLap,
                }}
                onChange={(c) => setForm((f) => ({ ...f, ...c }))}
              />
              <select
                className={styles.cabinSelect}
                name="cabin"
                value={form.cabin}
                onChange={update}
                aria-label="Cabin"
              >
                <option value="economy">Economy</option>
                <option value="premium">Premium economy</option>
                <option value="business">Business</option>
                <option value="first">First class</option>
              </select>
            </div>
          </div>

          <div className={styles.chips} role="group" aria-label="Trip type">
            <button
              type="button"
              className={styles.chip}
              aria-pressed={form.tripType === "round-trip"}
              onClick={() => setTripType("round-trip")}
            >
              Round trip
            </button>
            <button
              type="button"
              className={styles.chip}
              aria-pressed={form.tripType === "one-way"}
              onClick={() => setTripType("one-way")}
            >
              One way
            </button>
          </div>

          <p className={styles.promise}>
            {/* JSX collapses the whitespace between a closing tag and same-line text at the
                start of the next source line, so a plain space here silently disappears
                (verified: it rendered as "history.The airline's" with no gap). {" "} forces
                a real space that survives the collapse. */}
            <b>We don&apos;t inflate prices based on your search history.</b>{" "}
            The airline&apos;s price at checkout can still move with market and currency. That
            part is outside our control.
          </p>

          <button className={styles.submit} type="submit" disabled={loading}>
            {loading ? "Searching…" : "Search flights"}
          </button>
        </form>
      )}

      {/* A live search can run half a minute. The stage list says where that time
          is going, and the placeholders hold the space so nothing jumps when the
          real cards land. */}
      {loading && (
        <div className={styles.loadingWrap}>
          <SearchProgress stage={stage} roundTrip={Boolean(form.returnDate)} />
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.skeleton} aria-hidden="true">
              <div className={styles.skLine} style={{ width: "45%", height: 20 }} />
              <div className={styles.skLine} style={{ width: "72%" }} />
              <div className={styles.skLine} style={{ width: "60%" }} />
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {data && (
        <section className={styles.results}>
          <div className={styles.searchbar}>
            <button
              type="button"
              className={styles.backButton}
              onClick={resetSearch}
              aria-label="Start a new search"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <div className={styles.searchbarInfo}>
              <p className={styles.searchRoute} ref={resultsHeadingRef} tabIndex={-1}>
                {form.origin} → {form.destination}
              </p>
              <p className={styles.searchMeta} role="status" aria-live="polite">
                {(() => {
                  const nights = nightsBetween(form.depart, form.returnDate);
                  const count = data.flights.length;
                  const noun = data.source === "serpapi" ? "live fare" : "demo fare";
                  return [
                    CABIN_LABEL[form.cabin] || form.cabin,
                    nights ? `${nights} ${nights === 1 ? "night" : "nights"}` : null,
                    `${count} ${noun}${count === 1 ? "" : "s"} read`,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                })()}
              </p>
            </div>
            <button type="button" className={styles.editButton} onClick={() => setEditing(true)}>
              Edit
            </button>
          </div>

          {data.flights.length === 0 ? (
            <p className={styles.empty}>
              No flights found for this route on these dates. Try different dates, or a nearby airport.
            </p>
          ) : (
            <>
              {/* Layer 1: the honest read, printed as a solid block in record navy
                  so it reads as one finding, not a list of bullet points. */}
              <section className={styles.read} aria-labelledby="honest-read-title">
                <h2 id="honest-read-title" className={styles.readKicker}>
                  The honest read
                </h2>
                {data.summary
                  .split("\n")
                  .filter(Boolean)
                  .map((line, i) => (
                    <p key={i} className={styles.readLine}>
                      {renderHonestLine(noEmDash(line), data.flights)}
                    </p>
                  ))}
              </section>

              {/* Real per-search price context from SerpApi (price_insights).
                  Only rendered when the data exists — never invented. Sits below
                  the read, quiet grey, not part of the finding itself. */}
              {priceInsightLine(data.priceInsights) && (
                <p className={styles.insight}>{priceInsightLine(data.priceInsights)}</p>
              )}

              <div className={styles.sectionLabel}>{data.flights.length} options found</div>

              {/* Layer 2 + 3: one boarding-pass ticket per flight. The single
                  cheapest fare gets the green "Cheapest" tag; cards reveal with
                  a slight stagger (index drives the delay). */}
              {(() => {
                const cheapestId = data.flights.reduce(
                  (min, f) => (f.price < min.price ? f : min),
                  data.flights[0]
                )?.id;
                return (
                  <div className={styles.cards}>
                    {data.flights.map((f, i) => (
                      <FlightCard
                        key={f.id}
                        flight={f}
                        risks={data.riskMap[f.id] || []}
                        verdict={data.verdicts[f.id]}
                        search={data.search}
                        cheapest={f.id === cheapestId}
                        index={i}
                      />
                    ))}
                  </div>
                );
              })()}
            </>
          )}

          {data.source !== "serpapi" && (
            <p className={styles.foot}>Demo fares. Hand-written sample data, not live prices.</p>
          )}
        </section>
      )}
    </>
  );
}
