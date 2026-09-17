import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useRequestsQuery } from "../api/queries";
import { ApiError } from "../api/client";
import type { RequestStatus } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Alert } from "../components/Alert";
import { Amount } from "../components/Amount";
import { Button, buttonClassName } from "../components/Button";
import { Card, CardBody, CardFooter } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { Field } from "../components/Field";
import { Input } from "../components/Input";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { Select } from "../components/Select";
import { StatusBadge } from "../components/StatusBadge";
import { Table, tableCell } from "../components/Table";
import { cx } from "../lib/cx";
import { formatDateTime } from "../lib/format";
import styles from "./RequestsListPage.module.css";

const PAGE_SIZE = 20;

function isRequestStatus(value: string): value is RequestStatus {
  return value === "PENDING" || value === "APPROVED" || value === "REJECTED";
}

export function RequestsListPage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const statusParam = searchParams.get("status") ?? "";
  const status = isRequestStatus(statusParam) ? statusParam : undefined;
  const search = searchParams.get("search") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const [searchInput, setSearchInput] = useState(search);

  const { data, isLoading, isError, error, refetch } = useRequestsQuery({
    status,
    search: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const isAnalyst = session?.role === "ANALYST";
  const hasFilters = Boolean(status) || Boolean(search);

  function updateParams(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    }
    setSearchParams(next);
  }

  function handleStatusChange(event: ChangeEvent<HTMLSelectElement>) {
    updateParams({ status: event.target.value || undefined, page: undefined });
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateParams({ search: searchInput.trim() || undefined, page: undefined });
  }

  function handleClearFilters() {
    setSearchInput("");
    updateParams({ search: undefined, status: undefined, page: undefined });
  }

  function goToPage(nextPage: number) {
    updateParams({ page: nextPage > 1 ? String(nextPage) : undefined });
  }

  return (
    <>
      <PageHeader
        title="Disbursement requests"
        description={
          isAnalyst
            ? "Create disbursement requests and track their approval status."
            : "Review pending disbursement requests and record an approval decision."
        }
        actions={
          isAnalyst ? (
            <Link to="/requests/new" className={buttonClassName()}>
              New request
            </Link>
          ) : undefined
        }
      />

      <Card>
        <form className={styles.toolbar} onSubmit={handleSearchSubmit} role="search">
          <Field htmlFor="search" label="Search" className={styles.searchField}>
            <Input
              id="search"
              type="search"
              placeholder="Supplier name or external reference"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </Field>

          <Field htmlFor="status" label="Status" className={styles.statusField}>
            <Select id="status" value={status ?? ""} onChange={handleStatusChange}>
              <option value="">All</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </Select>
          </Field>

          <div className={styles.toolbarActions}>
            <Button type="submit">Search</Button>
            {hasFilters && (
              <Button type="button" variant="ghost" onClick={handleClearFilters}>
                Clear
              </Button>
            )}
          </div>
        </form>

        {isLoading && <LoadingState label="Loading requests..." />}

        {isError && (
          <CardBody>
            <Alert
              variant="error"
              role="alert"
              title="Could not load requests"
              actions={
                <Button variant="secondary" size="sm" onClick={() => refetch()}>
                  Retry
                </Button>
              }
            >
              {error instanceof ApiError ? error.message : "Failed to load requests."}
            </Alert>
          </CardBody>
        )}

        {!isLoading && !isError && data && data.items.length === 0 && (
          <EmptyState
            title="No requests match these filters"
            description="Adjust the status filter or search term to widen the results."
            action={
              hasFilters ? (
                <Button variant="secondary" size="sm" onClick={handleClearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        )}

        {!isLoading && !isError && data && data.items.length > 0 && (
          <>
            <Table caption="Disbursement requests">
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Supplier</th>
                  <th scope="col" className={tableCell.numeric}>
                    Amount
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td className={styles.reference}>
                      <Link to={`/requests/${item.id}`}>{item.externalReference}</Link>
                    </td>
                    <td className={styles.supplier}>{item.supplier.name}</td>
                    <td className={tableCell.numeric}>
                      <Amount value={item.amount} currency={item.currency} />
                    </td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td className={cx(styles.date, tableCell.nowrap)}>{formatDateTime(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <CardFooter>
              <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={goToPage} />
            </CardFooter>
          </>
        )}
      </Card>
    </>
  );
}
