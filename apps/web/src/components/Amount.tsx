import styles from "./Amount.module.css";

// The API returns amounts as exact decimal strings; they are rendered
// verbatim rather than run through Intl currency formatting, which would
// re-round them and vary by the viewer's locale.
export function Amount({ value, currency }: { value: string; currency: string }) {
  return (
    <span className={styles.amount}>
      <span className={styles.value}>{value}</span>
      <span className={styles.currency}>{currency}</span>
    </span>
  );
}
