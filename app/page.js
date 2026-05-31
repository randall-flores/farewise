import SearchExperience from "./search-experience";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <main className={styles.page}>
      <p className={styles.eyebrow}>Flight search that tells you the truth</p>
      <h1 className={styles.title}>FareWise</h1>
      <p className={styles.subtitle}>
        We don&apos;t book your flight or hide the catch. We compare the real options,
        explain the trade-offs in plain language, then send you to book direct.
      </p>
      <SearchExperience />
    </main>
  );
}
