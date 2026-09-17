import type { ReactNode } from "react";
import { cx } from "../lib/cx";
import styles from "./FormControls.module.css";

interface FieldProps {
  /** id of the control this field labels. */
  htmlFor: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

// The control is passed in rather than rendered here so each page keeps full
// control of its own value/onChange wiring and of the aria-describedby /
// aria-invalid attributes it points at the hint and error nodes below.
export function Field({ htmlFor, label, hint, error, children, className }: FieldProps) {
  return (
    <div className={cx(styles.field, className)}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
      </label>
      {hint && (
        <p className={styles.hint} id={`${htmlFor}-hint`}>
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p className={styles.error} id={`${htmlFor}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
