import { Button } from "./Button";
import styles from "./Pagination.module.css";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, onPageChange }: PaginationProps) {
  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <p className={styles.summary}>
        Page {page} of {Math.max(totalPages, 1)} · {total} total
      </p>
      <div className={styles.controls}>
        <Button variant="secondary" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          Next
        </Button>
      </div>
    </nav>
  );
}
