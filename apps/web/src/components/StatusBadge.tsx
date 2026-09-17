import type { DecisionValue, RequestStatus } from "../api/types";
import { cx } from "../lib/cx";
import styles from "./StatusBadge.module.css";

interface StatusBadgeProps {
  status: RequestStatus | DecisionValue;
  size?: "sm" | "lg";
}

// Renders the raw status value rather than a prettified label: this is the
// exact string the API returns and the one an operator will see in logs and
// in the status filter, so keeping them identical avoids a translation layer
// between what the UI says and what the system stores.
export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  return (
    <span className={cx(styles.badge, styles[status], size === "lg" && styles.lg)}>
      <span className={styles.dot} aria-hidden="true" />
      {status}
    </span>
  );
}
