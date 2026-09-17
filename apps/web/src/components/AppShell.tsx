import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import type { Role } from "../auth/session";
import { cx } from "../lib/cx";
import styles from "./AppShell.module.css";
import { Button } from "./Button";

interface AppShellProps {
  username: string;
  role: Role;
  onLogout: () => void;
  children: ReactNode;
}

/**
 * The single chrome every authenticated page renders inside: brand, the one
 * real navigation destination this app has, the current identity/role, and
 * the log-out control. Deliberately no dashboard, metrics or extra sections
 * — the only routes that exist are the requests list, a request's detail,
 * and the analyst-only create form.
 */
export function AppShell({ username, role, onLogout, children }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.left}>
            <Link to="/requests" className={styles.brand}>
              <span className={styles.brandMark} aria-hidden="true">
                IAS
              </span>
              Disbursements
            </Link>
            <nav className={styles.nav} aria-label="Main">
              <NavLink to="/requests" className={({ isActive }) => cx(styles.navLink, isActive && styles.navLinkActive)}>
                Requests
              </NavLink>
            </nav>
          </div>

          <div className={styles.user}>
            <div className={styles.identity}>
              <span className={styles.username}>{username}</span>
              <span className={styles.role}>{role}</span>
            </div>
            <Button variant="secondary" size="sm" onClick={onLogout}>
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
