import type { ReactNode } from "react";
import { cx } from "../lib/cx";
import styles from "./Alert.module.css";

type AlertVariant = "error" | "warning" | "info" | "success";

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  /** Trailing controls, e.g. a Retry button on a failed fetch. */
  actions?: ReactNode;
  /**
   * Opt-in only. An alert that appears in response to a user action (a failed
   * login, a rejected decision) should announce itself; a permanently
   * rendered informational note should not keep interrupting a screen reader.
   */
  role?: "alert" | "status";
  className?: string;
}

export function Alert({ variant = "error", title, children, actions, role, className }: AlertProps) {
  return (
    <div className={cx(styles.alert, styles[variant], className)} role={role}>
      <div>
        {title && <p className={styles.title}>{title}</p>}
        <p>{children}</p>
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
