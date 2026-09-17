import type { ReactNode } from "react";
import { cx } from "../lib/cx";
import styles from "./Card.module.css";

interface CardProps {
  children: ReactNode;
  className?: string;
}

// Always a <section> so every panel is a real landmark-ish region and so
// callers can scope queries to it (the decision panel on the detail page
// relies on being findable from its own heading).
export function Card({ children, className }: CardProps) {
  return <section className={cx(styles.card, className)}>{children}</section>;
}

interface CardHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

export function CardHeader({ title, description, actions }: CardHeaderProps) {
  return (
    <div className={styles.header}>
      <div>
        <h2 className={styles.title}>{title}</h2>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

interface CardBodyProps {
  children: ReactNode;
  /** Removes padding so a table can sit flush against the card edges. */
  flush?: boolean;
  className?: string;
}

export function CardBody({ children, flush, className }: CardBodyProps) {
  return <div className={cx(styles.body, flush && styles.bodyFlush, className)}>{children}</div>;
}

export function CardFooter({ children }: { children: ReactNode }) {
  return <div className={styles.footer}>{children}</div>;
}
