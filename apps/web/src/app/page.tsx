import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <p className={styles.arabic} lang="ar" dir="rtl">
          خِشّه
        </p>
        <h1 className={styles.brand}>Khisha</h1>
        <p className={styles.tagline}>Save it now, find it later.</p>
        <p className={styles.tagline} lang="ar" dir="rtl">
          خِشّه الحين، تلقاه بعدين
        </p>
      </section>
      <p className={styles.note}>Khisha is in private testing. A public release is coming later.</p>
    </main>
  );
}
