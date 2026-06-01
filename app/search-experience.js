"use client";
import { useState, useEffect, useRef } from "react";
import { formatMoney, totalExtraFees, allInPrice } from "@/lib/flight-helpers";
import { searchAirports, loadAirports } from "@/lib/airport-search";
import styles from "./page.module.css";

// A From/To field with debounced airport/city autocomplete.
// Shows what the user types; commits the chosen IATA code to the parent form.
function AirportField({ label, name, initial, onSelect }) {
  const [text, setText] = useState(initial); // what's visible in the box
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1); // highlighted suggestion for arrow-key nav
  const [invalid, setInvalid] = useState(false); // typed something but never picked a real place
  const blurTimer = useRef(null);
  const committed = useRef(Boolean(initial)); // a valid code is currently chosen for this field
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
    // Let power users type a raw 3-letter code directly (e.g. "JFK").
    const code = value.trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(code)) {
      committed.current = true;
      onSelect(code);
    } else {
      committed.current = false; // edited text no longer matches a chosen place
      onSelect(""); // tell the parent this field has no valid code right now
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
    onSelect(place.code); // the parent stores the IATA code for the search
    setText(place.label); // the box shows the friendly label, e.g. "Berlin (BER) — Brandenburg"
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
      <span>{label}</span>
      <div className={styles.autocomplete}>
        <input
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

// Split-flap departure-board rendering of a route code (e.g. "MIA" -> three tiles).
function FlapBoard({ origin, destination }) {
  // On load nothing is chosen yet — show a dimmed sample route so the signature
  // board is visible immediately, then brighten to the live route as they type.
  const ghost = !origin && !destination;
  const from = origin || "MIA";
  const to = destination || "BER";
  const tiles = (code) =>
    String(code || "")
      .toUpperCase()
      .split("")
      .map((ch, i) => (
        <div key={i} className={styles.flap}>
          <span>{ch}</span>
        </div>
      ));
  return (
    <div
      className={`${styles.board} ${ghost ? styles.boardGhost : ""}`}
      aria-label={ghost ? "Your route appears here" : `${origin} to ${destination}`}
    >
      <div className={styles.code}>{tiles(from)}</div>
      <div className={styles.arrow}>→</div>
      <div className={styles.code}>{tiles(to)}</div>
    </div>
  );
}

// Verdict level → flag color class + glyph (color is never the only signal; the tag text carries meaning).
const VERDICT_CLASS = { good: "flagGood", caution: "flagCaution", "high-risk": "flagRisk" };
const VERDICT_ICON = { good: "✓", caution: "!", "high-risk": "▲" };

const CABIN_LABEL = { economy: "Economy", premium: "Premium economy", business: "Business" };

// Build the board-style route line ("MIA — LIS — BER") from the segments.
function routeCodes(segments = []) {
  const first = segments[0]?.from;
  const rest = segments.map((s) => s.to);
  return [first, ...rest].filter(Boolean).join(" — ");
}

// One leg's line: route + stops + duration, then its clock times with day offset.
// `label` ("Outbound"/"Return") is set on round trips; it also turns on the
// per-leg airline (outbound and return can be different airlines).
function LegLine({ segments, stops, totalDuration, label }) {
  if (!segments?.length) return null;
  const dep = clockTime(segments[0]?.depart);
  const arr = clockTime(segments[segments.length - 1]?.arrive);
  const off = dayOffset(segments[0]?.depart, segments[segments.length - 1]?.arrive);
  const date = shortDate(segments[0]?.depart);
  return (
    <div className={styles.leg}>
      {label && (
        <span className={styles.legLabel}>
          {label}
          {date && <span className={styles.legDate}>{date}</span>}
        </span>
      )}
      <p className={styles.route}>
        <b>{routeCodes(segments)}</b> &nbsp;·&nbsp;{" "}
        {stops === 0 ? "no stops" : `${stops} stop${stops === 1 ? "" : "s"}`}{" "}
        &nbsp;·&nbsp; {totalDuration}
        {label && segments[0]?.airline ? (
          <span className={styles.legAirline}> · {segments[0].airline}</span>
        ) : null}
      </p>
      {dep && arr && (
        <p className={styles.times}>
          {dep} <span className={styles.timesArrow}>→</span> {arr}
          {off > 0 && (
            <span
              className={styles.dayOffset}
              aria-label={off === 1 ? "arrives the next day" : `arrives ${off} days later`}
            >
              {" "}
              +{off}
            </span>
          )}
        </p>
      )}
    </div>
  );
}

// On-brand price-context line from SerpApi price_insights (real, per search), or
// null. Honest: if a piece is missing we just don't say it.
function priceInsightLine(pi) {
  if (!pi) return null;
  const money = (n) => formatMoney(n, "USD");
  const range = pi.typicalPriceRange;
  if (pi.priceLevel && range) {
    return `Prices for this route are currently ${pi.priceLevel} — typical range ${money(range[0])}–${money(range[1])}.`;
  }
  if (pi.priceLevel) return `Prices for this route are currently ${pi.priceLevel}.`;
  if (range) return `Typical price for this route: ${money(range[0])}–${money(range[1])}.`;
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

// Render one honest-read line with the airline (bold) and price (mono) pulled
// out as an emphasized lead-in. We key off the REAL data (the flights' airline
// names + a $ token), not a fixed prose template, so the wording can vary freely
// and we still emphasize the two things people scan for. No amber (reserved for
// actions). Falls back to plain text when nothing matches.
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
      <button type="button" className={styles.toggle} onClick={toggle} aria-expanded={open}>
        <span>{open ? "Hide booking options" : "How to book"}</span>
        <span className={styles.chev}>↓</span>
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
                Live bookable prices — these are what the seller charges and can differ from the
                price above.
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

// One flight result card.
// At a glance: airline, route, verdict flag, price, all-in price, and ALWAYS-visible warnings.
// Behind "Explain": the full reasoning (incl. cabin-upgrade note) and the segment breakdown.
function FlightCard({ flight, risks, verdict, search }) {
  const [open, setOpen] = useState(false);
  const fees = totalExtraFees(flight);
  const allIn = allInPrice(flight);
  const feesKnown = flight.feesKnown !== false; // false only when the data source didn't itemize fees
  const level = verdict?.verdict ?? "caution";
  const roundTrip = flight.tripType === "round-trip";

  return (
    <article className={`${styles.card} ${open ? styles.open : ""} ${level === "high-risk" ? styles.muted : ""}`}>
      <div className={styles.head}>
        <div className={styles.headMain}>
          <h2 className={styles.airline}>{flight.bookVia.name}</h2>
          <div className={styles.legs}>
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
          </div>
        </div>

        <div className={styles.priceCol}>
          <div className={`${styles.price} ${level === "high-risk" ? styles.dim : ""}`}>
            {formatMoney(flight.price, flight.currency)}
          </div>
          {roundTrip && <div className={styles.priceUnit}>round trip</div>}
          <div className={styles.allin}>
            {!feesKnown ? (
              "fare only · fees not listed"
            ) : fees > 0 ? (
              <>
                <b>~{formatMoney(allIn, flight.currency)}</b> total
              </>
            ) : (
              "no extra fees"
            )}
          </div>
        </div>

        {/* Always-visible verdict flag (color-coded). */}
        {verdict?.tag && (
          <div className={`${styles.flag} ${styles[VERDICT_CLASS[level]]}`}>
            <span className={styles.ic} aria-hidden="true">{VERDICT_ICON[level]}</span>
            <span>{verdict.tag}</span>
          </div>
        )}

        {/* Warnings ALWAYS show — even collapsed. Deterministic, from code, not the AI. */}
        {risks.length > 0 && (
          <div className={styles.warnings}>
            {risks.map((r, i) => (
              <p key={i} className={`${styles.warn} ${styles[`warn_${r.severity}`]}`}>
                <span className={styles.warnLbl}>{r.severity === "info" ? "Note" : "Warning"}</span>
                {r.message}
              </p>
            ))}
          </div>
        )}

        <button
          type="button"
          className={styles.toggle}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <span>{open ? "Hide detail" : "Explain"}</span>
          <span className={styles.chev}>↓</span>
        </button>

        {/* Layer 3: full reasoning + segment breakdown, smooth-expanded on demand. */}
        <div className={styles.detail}>
          <div className={styles.detailInner}>
            <div className={styles.detailPad}>
              <ul className={styles.segments}>
                {roundTrip && <li className={styles.segHead}>Outbound</li>}
                {flight.segments.map((s, i) => (
                  <li key={`o${i}`}>
                    <b>{s.from} → {s.to}</b> · {s.airline} {s.flightNo} · {s.duration}
                  </li>
                ))}
                {roundTrip && flight.returnSegments?.length > 0 && (
                  <>
                    <li className={styles.segHead}>Return</li>
                    {flight.returnSegments.map((s, i) => (
                      <li key={`r${i}`}>
                        <b>{s.from} → {s.to}</b> · {s.airline} {s.flightNo} · {s.duration}
                      </li>
                    ))}
                  </>
                )}
              </ul>
              {verdict?.explanation ? (
                verdict.explanation
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
      </div>
    </article>
  );
}

export default function SearchExperience() {
  const [form, setForm] = useState({
    origin: "",
    destination: "",
    depart: "",
    returnDate: "",
    cabin: "economy",
  });

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null); // { flights, riskMap, summary, verdicts }
  const [error, setError] = useState(null);
  // Bumped on reset to remount the autocomplete fields (they hold their own
  // visible text, so clearing form state alone wouldn't empty the boxes).
  const [resetKey, setResetKey] = useState(0);

  // Today, as YYYY-MM-DD, for the date inputs' `min` and the submit-time guard.
  const today = new Date().toISOString().slice(0, 10);

  function update(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function resetSearch() {
    setForm({ origin: "", destination: "", depart: "", returnDate: "", cabin: "economy" });
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
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.error) setError(json.error);
      else setData(json);
    } catch {
      setError("Network error. Is the dev server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Split hero: pitch + live board on the left, the search form on the right.
          Collapses to a single column (and a tighter top margin) once a search runs. */}
      <div className={`${styles.hero} ${data || loading ? styles.heroCompact : ""}`}>
        <div className={styles.heroIntro}>
          <p className={styles.kicker}>Flight search that tells you the truth</p>
          <h1 className={styles.brand}>FareWise</h1>
          <FlapBoard origin={form.origin} destination={form.destination} />
        </div>

        <div className={styles.heroPitch}>
          <p className={styles.subtitle}>
            We don&apos;t book your flight or hide the catch. We compare the real
            options, explain the trade-offs in plain language, then send you to book
            direct.
          </p>
        </div>

        <div className={styles.heroForm}>
          <form className={styles.form} onSubmit={onSubmit}>
            <p className={styles.formTitle}>Find your flight</p>
            <div className={styles.row}>
              <AirportField
                key={`origin-${resetKey}`}
                label="From"
                name="origin"
                initial={form.origin}
                onSelect={(code) => setForm((f) => ({ ...f, origin: code }))}
              />
              <AirportField
                key={`destination-${resetKey}`}
                label="To"
                name="destination"
                initial={form.destination}
                onSelect={(code) => setForm((f) => ({ ...f, destination: code }))}
              />
            </div>
            <div className={styles.row}>
              <label className={styles.field}>
                <span>Depart</span>
                <input type="date" name="depart" value={form.depart} onChange={update} min={today} required />
              </label>
              <label className={styles.field}>
                <span>Return (optional)</span>
                <input
                  type="date"
                  name="returnDate"
                  value={form.returnDate}
                  onChange={update}
                  min={form.depart || today}
                />
              </label>
              <label className={styles.field}>
                <span>Cabin</span>
                <select name="cabin" value={form.cabin} onChange={update}>
                  <option value="economy">Economy</option>
                  <option value="premium">Premium economy</option>
                  <option value="business">Business</option>
                </select>
              </label>
            </div>
            <button className={styles.submit} type="submit" disabled={loading}>
              {loading ? "Searching…" : "Search flights →"}
            </button>
          </form>
        </div>
      </div>

      {loading && (
        <div className={styles.loading} role="status" aria-live="polite">
          <div className={styles.spinner} />
          <p>Reading the real options and the fine print…</p>
        </div>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {data && (
        <section className={styles.results}>
          <div className={styles.resultsHead}>
            <p className={styles.meta} role="status" aria-live="polite">
              {/* Factual label from the actual data source — never call real fares "demo". */}
              <span className={styles.dot} /> {data.source === "serpapi" ? "Live fares" : "Demo fares"}
              <span className={styles.sep}>·</span> {form.origin} → {form.destination}
              <span className={styles.sep}>·</span> {CABIN_LABEL[form.cabin] || form.cabin}
              <span className={styles.sep}>·</span> {data.flights.length} options
            </p>
            <button type="button" className={styles.newSearch} onClick={resetSearch}>
              New search
            </button>
          </div>

          {data.flights.length === 0 ? (
            <p className={styles.empty}>
              No flights found for this route on these dates. Try different dates, or a nearby airport.
            </p>
          ) : (
            <>
              {/* Real per-search price context from SerpApi (price_insights).
                  Only rendered when the data exists — never invented. */}
              {priceInsightLine(data.priceInsights) && (
                <p className={styles.priceInsight}>
                  <span className={styles.priceInsightDot} aria-hidden="true" />
                  {priceInsightLine(data.priceInsights)}
                </p>
              )}

              {/* Layer 1: the short summary; amber verdict tag carries the accent. */}
              <section className={styles.verdict}>
                <h2 className={styles.verdictTag}>FareWise&apos;s honest read</h2>
                {data.summary
                  .split("\n")
                  .filter(Boolean)
                  .map((line, i) => (
                    <p key={i} className={styles.summaryLine}>
                      {renderHonestLine(line, data.flights)}
                    </p>
                  ))}
              </section>

              <div className={styles.sectionLabel}>{data.flights.length} options found</div>

              {/* Layer 2 + 3: one card per flight. */}
              <div className={styles.cards}>
                {data.flights.map((f) => (
                  <FlightCard
                    key={f.id}
                    flight={f}
                    risks={data.riskMap[f.id] || []}
                    verdict={data.verdicts[f.id]}
                    search={data.search}
                  />
                ))}
              </div>
            </>
          )}

          {data.source !== "serpapi" && (
            <p className={styles.foot}>Demo fares — hand-written sample data, not live prices.</p>
          )}
        </section>
      )}
    </>
  );
}
