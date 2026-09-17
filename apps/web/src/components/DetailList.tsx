import { Fragment, type ReactNode } from "react";
import { cx } from "../lib/cx";
import styles from "./DetailList.module.css";

export interface DetailItem {
  label: string;
  value: ReactNode;
  /** Preserve line breaks — for operator-entered free text. */
  multiline?: boolean;
}

interface DetailListProps {
  items: DetailItem[];
  /** Put each value under its label instead of beside it. */
  stacked?: boolean;
}

export function DetailList({ items, stacked }: DetailListProps) {
  return (
    <dl className={cx(styles.list, stacked && styles.stacked)}>
      {items.map((item) => (
        <Fragment key={item.label}>
          <dt className={styles.term}>{item.label}</dt>
          <dd className={cx(styles.definition, item.multiline && styles.multiline)}>{item.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
