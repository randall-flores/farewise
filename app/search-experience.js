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
function routeCodes(flight) {
  const first = flight.segments[0]?.from;
  const rest = flight.segments.map((s) => s.to);
  return [first, ...rest].filter(Boolean).join(" — ");
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

// One flight result card.
// At a glance: airline, route, verdict flag, price, all-in price, and ALWAYS-visible warnings.
// Behind "Explain": the full reasoning (incl. cabin-upgrade note) and the segment breakdown.
function FlightCard({ flight, risks, verdict }) {
  const [open, setOpen] = useState(false);
  const fees = totalExtraFees(flight);
  const allIn = allInPrice(flight);
  const feesKnown = flight.feesKnown !== false; // false only when the data source didn't itemize fees
  const level = verdict?.verdict ?? "caution";

  return (
    <article className={`${styles.card} ${open ? styles.open : ""} ${level === "high-risk" ? styles.muted : ""}`}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.airline}>{flight.bookVia.name}</h2>
          <p className={styles.route}>
            <b>{routeCodes(flight)}</b> &nbsp;·&nbsp;{" "}
            {flight.stops === 0 ? "no stops" : `${flight.stops} stop${flight.stops === 1 ? "" : "s"}`}{" "}
            &nbsp;·&nbsp; {flight.totalDuration}
          </p>
        </div>

        <div className={styles.priceCol}>
          <div className={`${styles.price} ${level === "high-risk" ? styles.dim : ""}`}>
            {formatMoney(flight.price, flight.currency)}
          </div>
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
                {flight.segments.map((s, i) => (
                  <li key={i}>
                    <b>{s.from} → {s.to}</b> · {s.airline} {s.flightNo} · {s.duration}
                  </li>
                ))}
              </ul>
              {verdict?.explanation ? (
                verdict.explanation
                  .split("\n")
                  .filter(Boolean)
                  .map((p, i) => <p key={i}>{p}</p>)
              ) : (
                <p>No further detail available.</p>
              )}
              {flight.bookVia?.url ? (
                <a
                  className={styles.book}
                  href={flight.bookVia.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Book direct with {flight.bookVia.name} ↗
                </a>
              ) : (
                // We don't fetch seller/booking links on the results page. This is
                // the clearly-marked spot to pull them lazily later — on expand or
                // book click — using flight.bookVia.token (SerpApi booking_token).
                // TODO(phase: booking links): fetch + render the real booking link.
                <p className={styles.bookSoon}>
                  We send you to {flight.bookVia.name} to book. We don&apos;t load
                  seller links until you&apos;re ready, so prices stay the airline&apos;s own.
                </p>
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
          <p className={styles.trust}>
            <span className={styles.trustDot} aria-hidden="true" />
            No commissions — we send you straight to the airline to book.
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
                    <p key={i} className={styles.summaryLine}>{line}</p>
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
                  />
                ))}
              </div>
            </>
          )}

          <p className={styles.foot}>
            {data.source === "serpapi"
              ? "Live fares from Google Flights. "
              : "Demo fares — hand-written sample data, not live prices. "}
            We don&apos;t take airline commissions; the explanation is what we&apos;d actually tell a
            friend.
          </p>
        </section>
      )}
    </>
  );
}
