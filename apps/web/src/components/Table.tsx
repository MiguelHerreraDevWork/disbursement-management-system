import type { ReactNode } from "react";
import styles from "./Table.module.css";

interface TableProps {
  caption?: string;
  children: ReactNode;
}

/** Cell modifiers callers can apply to individual <td>/<th> elements. */
export const tableCell = {
  numeric: styles.numeric,
  nowrap: styles.nowrap,
};

export function Table({ caption, children }: TableProps) {
  return (
    <div className={styles.scroll}>
      <table className={styles.table} aria-label={caption}>
        {children}
      </table>
    </div>
  );
}
