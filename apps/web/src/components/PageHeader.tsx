import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import styles from "./PageHeader.module.css";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Rendered next to the title, e.g. a status badge. */
  badge?: ReactNode;
  backTo?: string;
  backLabel?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, badge, backTo, backLabel, actions }: PageHeaderProps) {
  return (
    <div className={styles.header}>
      {backTo && (
        <Link to={backTo} className={styles.back}>
          <span aria-hidden="true">&#8592;</span>
          {backLabel ?? "Back"}
        </Link>
      )}
      <div className={styles.row}>
        <div>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{title}</h1>
            {badge}
          </div>
          {description && <p className={styles.description}>{description}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </div>
  );
}
