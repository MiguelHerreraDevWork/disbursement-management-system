import { forwardRef, type SelectHTMLAttributes } from "react";
import { cx } from "../lib/cx";
import styles from "./FormControls.module.css";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ invalid, className, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cx(styles.control, styles.select, invalid && styles.invalid, className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});
