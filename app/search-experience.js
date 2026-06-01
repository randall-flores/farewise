"use client";
import { useState, useEffect, useRef } from "react";
import { formatMoney, totalExtraFees, allInPrice } from "@/lib/flight-helpers";
import styles from "./page.module.css";

// A From/To field with debounced airport/city autocomplete.
// Shows what the user types; commits the chosen IATA code to the parent form.
function AirportField({ label, name, initial, onSelect }) {
  const [text, setText] = useState(initial); // what's visible in the box
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1); // highlighted suggestion for arrow-key nav
  const blurTimer = useRef(null);

  // Debounce: every time `text` changes we (re)start a 300ms timer. If the user
  // types again before it fires, the cleanup clears it — so we only call the API
  // ~300ms AFTER they stop typing, not on every keystroke. All state updates live
  // inside the timer callback (never synchronously in the effect body).
  useEffect(() => {
    const q = text.trim();
    const timer = setTimeout(async () => {
      if (q.length < 2) {
        setResults([]);
        setActive(-1);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        setResults(json.places || []);
        setActive(-1); // new list -> nothing highlighted yet
        setOpen(true);
      } catch {
        setResults([]);
        setActive(-1);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer); // cancel the pending request if text changed
  }, [text]);

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
    setActive(-1);
    // Let power users type a raw 3-letter code directly (e.g. "JFK").
    const code = value.trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(code)) onSelect(code);
  }

  function choose(place) {
    onSelect(place.code); // the parent stores the IATA code for the Duffel search
    setText(place.label); // the box shows the friendly label, e.g. "Miami (MIA)"
    setResults([]);
    setActive(-1);
    setOpen(false);
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
            if (results.length) setOpen(true);
          }}
          onBlur={() => {
            // Delay closing so a click on a suggestion still registers.
            blurTimer.current = setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={onKeyDown}
          placeholder="City or airport"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${name}-listbox`}
          aria-activedescendant={active >= 0 ? `${name}-opt-${active}` : undefined}
          aria-autocomplete="list"
          required
        />
        {open && (results.length > 0 || loading) && (
          <ul className={styles.suggestions} id={`${name}-listbox`} role="listbox">
            {loading && results.length === 0 && (
              <li className={styles.acStatus}>Searching…</li>
            )}
            {results.map((p, i) => (
              <li key={`${p.type}-${p.code}-${p.label}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  id={`${name}-opt-${i}`}
                  className={`${styles.suggestion} ${p.underCity ? styles.suggestionUnderCity : ""} ${
                    i === active ? styles.suggestionActive : ""
                  }`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(p)}
                >
                  {p.label}
                  <span className={styles.suggestionType}>{p.type}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </label>
  );
}

// Split-flap departure-board rendering of a route code (e.g. "MIA" -> three tiles).
function FlapBoard({ origin, destination }) {
  // Nothing chosen yet — don't show a lone arrow on the hero.
  if (!origin && !destination) return null;
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
    <div className={styles.board} aria-label={`${origin} to ${destination}`}>
      <div className={styles.code}>{tiles(origin)}</div>
      <div className={styles.arrow}>→</div>
      <div className={styles.code}>{tiles(destination)}</div>
    </div>
  );
}

// Verdict level → flag color class + glyph (color is never the only signal; the tag text carries meaning).
const VERDICT_CLASS = { good: "flagGood", caution: "flagCaution", "high-risk": "flagRisk" };
const VERDICT_ICON = { good: "✓", caution: "!", "high-risk": "!" };

const CABIN_LABEL = { economy: "Economy", premium: "Premium economy", business: "Business" };

// Build the board-style route line ("MIA — LIS — BER") from the segments.
function routeCodes(flight) {
  const first = flight.segments[0]?.from;
  const rest = flight.segments.map((s) => s.to);
  return [first, ...rest].filter(Boolean).join(" — ");
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
            <span className={styles.ic}>{VERDICT_ICON[level]}</span>
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
              <a
                className={styles.book}
                href={flight.bookVia.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Book direct with {flight.bookVia.name} ↗
              </a>
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
    depart: "2026-07-10",
    returnDate: "",
    cabin: "economy",
  });

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null); // { flights, riskMap, summary, verdicts }
  const [error, setError] = useState(null);

  function update(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function onSubmit(e) {
    e.preventDefault();
    // Both fields must hold a real code (chosen from the list, or a typed 3-letter code).
    if (!form.origin || !form.destination) {
      setError("Pick a city or airport from the suggestions for both From and To.");
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
      {/* Hero: split-flap board of the route being searched (live from the form). */}
      <FlapBoard origin={form.origin} destination={form.destination} />

      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.row}>
          <AirportField
            label="From"
            name="origin"
            initial={form.origin}
            onSelect={(code) => setForm((f) => ({ ...f, origin: code }))}
          />
          <AirportField
            label="To"
            name="destination"
            initial={form.destination}
            onSelect={(code) => setForm((f) => ({ ...f, destination: code }))}
          />
        </div>
        <div className={styles.row}>
          <label className={styles.field}>
            <span>Depart</span>
            <input type="date" name="depart" value={form.depart} onChange={update} required />
          </label>
          <label className={styles.field}>
            <span>Return (optional)</span>
            <input type="date" name="returnDate" value={form.returnDate} onChange={update} />
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

      {loading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Reading the real options and the fine print…</p>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {data && (
        <section className={styles.results}>
          <p className={styles.meta}>
            <span className={styles.dot} /> Demo fares
            <span className={styles.sep}>·</span> {form.origin} → {form.destination}
            <span className={styles.sep}>·</span> {CABIN_LABEL[form.cabin] || form.cabin}
            <span className={styles.sep}>·</span> {data.flights.length} options
          </p>

          {/* Layer 1: the short summary, amber left-rule. */}
          <section className={styles.verdict}>
            <div className={styles.verdictTag}>FareWise&apos;s honest read</div>
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

          <p className={styles.foot}>
            Phase 1 — prices are hand-written demo data, not live fares. We don&apos;t take airline
            commissions; the explanation is what we&apos;d actually tell a friend.
          </p>
        </section>
      )}
    </>
  );
}
