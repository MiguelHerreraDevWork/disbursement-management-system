import styles from "./StateBlock.module.css";

// role="status" (not "alert"): a pending fetch is a polite update, and this
// keeps the loading indicator out of the way of the assertive error alerts
// the same views render.
export function LoadingState({ label }: { label: string }) {
  return (
    <div className={styles.block} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      <p className={styles.label}>{label}</p>
    </div>
  );
}
