"use client";
import { useState } from "react";
import { formatMoney, totalExtraFees } from "@/lib/flight-helpers";
import styles from "./page.module.css";

// One flight result card. Shows price, segments, risk flags, and a book-direct link.
function FlightCard({ flight, risks }) {
  const fees = totalExtraFees(flight);
  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <div>
          <p className={styles.airline}>{flight.bookVia.name}</p>
          <p className={styles.route}>
            {flight.stops === 0 ? "Nonstop" : `${flight.stops} stop`} · {flight.totalDuration}
          </p>
        </div>
        <div className={styles.priceBox}>
          <span className={styles.price}>{formatMoney(flight.price, flight.currency)}</span>
          {fees > 0 && (
            <span className={styles.fees}>+{formatMoney(fees, flight.currency)} likely fees</span>
          )}
        </div>
      </div>

      <ul className={styles.segments}>
        {flight.segments.map((s, i) => (
          <li key={i}>
            <strong>{s.from} → {s.to}</strong> · {s.airline} {s.flightNo} · {s.duration}
          </li>
        ))}
      </ul>

      {risks.length > 0 && (
        <ul className={styles.risks}>
          {risks.map((r, i) => (
            <li key={i} className={styles[`risk_${r.severity}`]}>⚠ {r.message}</li>
          ))}
        </ul>
      )}

      <a className={styles.book} href={flight.bookVia.url} target="_blank" rel="noopener noreferrer">
        Book direct with {flight.bookVia.name} ↗
      </a>
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
  const [data, setData] = useState(null);   // { flights, riskMap, explanation }
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
          <div className={styles.explain}>
            <h2 className={styles.explainTitle}>FareWise&apos;s honest read</h2>
            {data.explanation
              .split("\n")
              .filter(Boolean)
              .map((p, i) => (
                <p key={i}>{p}</p>
              ))}
          </div>

          <div className={styles.list}>
            {data.flights.map((f) => (
              <FlightCard key={f.id} flight={f} risks={data.riskMap[f.id] || []} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
