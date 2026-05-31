"use client";
import { useState } from "react";
import { formatMoney, totalExtraFees, allInPrice } from "@/lib/flight-helpers";
import styles from "./page.module.css";

// Maps a verdict value to its CSS-module color class.
const VERDICT_CLASS = {
  good: "verdictGood",
  caution: "verdictCaution",
  "high-risk": "verdictHighRisk",
};

// One flight result card.
// At a glance: airline, route, verdict tag, price, all-in price, and ALWAYS-visible warnings.
// Behind "Explain": the full reasoning (incl. cabin-upgrade delta) and the segment breakdown.
function FlightCard({ flight, risks, verdict }) {
  const [open, setOpen] = useState(false);
  const fees = totalExtraFees(flight);
  const allIn = allInPrice(flight);
  const level = verdict?.verdict ?? "caution";

  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <div>
          <p className={styles.airline}>{flight.bookVia.name}</p>
          <p className={styles.route}>
            {flight.stops === 0 ? "Nonstop" : `${flight.stops} stop${flight.stops === 1 ? "" : "s"}`} · {flight.totalDuration}
          </p>
        </div>
        <div className={styles.priceBox}>
          <span className={styles.price}>{formatMoney(flight.price, flight.currency)}</span>
          <span className={styles.allIn}>
            {fees > 0 ? `~${formatMoney(allIn, flight.currency)} all-in` : "no add-on fees"}
          </span>
        </div>
      </div>

      {/* Layer 2: the one-line honest verdict, color-coded. */}
      {verdict?.tag && (
        <p className={`${styles.verdict} ${styles[VERDICT_CLASS[level]]}`}>{verdict.tag}</p>
      )}

      {/* Warnings ALWAYS show — even collapsed. Deterministic, from code, not the AI. */}
      {risks.length > 0 && (
        <ul className={styles.risks}>
          {risks.map((r, i) => (
            <li key={i} className={styles[`risk_${r.severity}`]}>⚠ {r.message}</li>
          ))}
        </ul>
      )}

      <div className={styles.cardActions}>
        <button
          type="button"
          className={styles.explainBtn}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          {open ? "Hide details" : "Explain"}
        </button>
        <a className={styles.book} href={flight.bookVia.url} target="_blank" rel="noopener noreferrer">
          Book direct ↗
        </a>
      </div>

      {/* Layer 3: full reasoning + segment detail, revealed on demand. */}
      {open && (
        <div className={styles.detail}>
          <ul className={styles.segments}>
            {flight.segments.map((s, i) => (
              <li key={i}>
                <strong>{s.from} → {s.to}</strong> · {s.airline} {s.flightNo} · {s.duration}
              </li>
            ))}
          </ul>
          {verdict?.explanation
            ? verdict.explanation
                .split("\n")
                .filter(Boolean)
                .map((p, i) => <p key={i}>{p}</p>)
            : <p>No further detail available.</p>}
        </div>
      )}
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
  const [data, setData] = useState(null);   // { flights, riskMap, summary, verdicts }
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
          {loading ? "Comparing…" : "Compare honestly →"}
        </button>
      </form>

      {/* Results render in place, below the form. */}
      {loading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Reading the real options and the fine print…</p>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {data && (
        <section className={styles.results}>
          {/* Layer 1: the short summary. */}
          <div className={styles.summary}>
            <h2 className={styles.summaryTitle}>FareWise&apos;s honest read</h2>
            <p>{data.summary}</p>
          </div>

          {/* Layer 2 + 3: one card per flight. */}
          <div className={styles.list}>
            {data.flights.map((f) => (
              <FlightCard
                key={f.id}
                flight={f}
                risks={data.riskMap[f.id] || []}
                verdict={data.verdicts[f.id]}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
