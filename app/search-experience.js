"use client";
import { useState } from "react";
import { formatMoney, totalExtraFees, allInPrice } from "@/lib/flight-helpers";
import styles from "./page.module.css";

// Split-flap departure-board rendering of a route code (e.g. "MIA" -> three tiles).
function FlapBoard({ origin, destination }) {
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
            {fees > 0 ? (
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
    origin: "MIA",
    destination: "BER",
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
          <label className={styles.field}>
            <span>From</span>
            <input name="origin" value={form.origin} onChange={update} required />
          </label>
          <label className={styles.field}>
            <span>To</span>
            <input name="destination" value={form.destination} onChange={update} required />
          </label>
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
