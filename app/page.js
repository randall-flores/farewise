import SearchExperience from "./search-experience";
import styles from "./page.module.css";

export default function HomePage() {
  // SearchExperience owns the whole hero now: the left column (wordmark + live
  // board + pitch) and the right column (search form) share the form state.
  return (
    <main className={styles.wrap}>
      <SearchExperience />
    </main>
  );
}
