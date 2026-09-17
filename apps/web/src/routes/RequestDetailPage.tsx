import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { useApproveMutation, useRejectMutation, useRequestQuery } from "../api/queries";
import { useAuth } from "../auth/AuthContext";
import { Alert } from "../components/Alert";
import { Amount } from "../components/Amount";
import { Button } from "../components/Button";
import { Card, CardBody, CardHeader } from "../components/Card";
import { DetailList, type DetailItem } from "../components/DetailList";
import { Field } from "../components/Field";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { Textarea } from "../components/Textarea";
import { formatDateTime } from "../lib/format";
import styles from "./RequestDetailPage.module.css";

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const { data, isLoading, isError, error, refetch } = useRequestQuery(id ?? "");

  const approveMutation = useApproveMutation();
  const rejectMutation = useRejectMutation();

  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);

  if (!id) {
    return (
      <>
        <PageHeader title="Request detail" backTo="/requests" backLabel="Back to requests" />
        <Card>
          <CardBody>
            <Alert variant="error" role="alert">
              No request id provided.
            </Alert>
          </CardBody>
        </Card>
      </>
    );
  }

  async function handleApprove() {
    setActionError(null);
    try {
      await approveMutation.mutateAsync({ id: id as string });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to approve the request.");
    }
  }

  async function handleRejectSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(null);
    try {
      await rejectMutation.mutateAsync({ id: id as string, reason: reason.trim() });
      setShowRejectForm(false);
      setReason("");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to reject the request.");
    }
  }

  const detailItems: DetailItem[] = data
    ? [
        { label: "Supplier", value: data.supplier.name },
        { label: "Tax ID", value: data.supplier.taxId },
        { label: "Amount", value: <Amount value={data.amount} currency={data.currency} /> },
        { label: "Concept", value: data.concept, multiline: true },
        { label: "Created", value: formatDateTime(data.createdAt) },
      ]
    : [];

  const canDecide = session?.role === "SUPERVISOR" && data?.status === "PENDING";

  return (
    <>
      <PageHeader
        title={data ? data.externalReference : "Request detail"}
        badge={data && <StatusBadge status={data.status} size="lg" />}
        backTo="/requests"
        backLabel="Back to requests"
      />

      {isLoading && (
        <Card>
          <LoadingState label="Loading request..." />
        </Card>
      )}

      {isError && (
        <Card>
          <CardBody>
            <Alert
              variant="error"
              role="alert"
              title="Could not load the request"
              actions={
                <Button variant="secondary" size="sm" onClick={() => refetch()}>
                  Retry
                </Button>
              }
            >
              {error instanceof ApiError ? error.message : "Failed to load the request."}
            </Alert>
          </CardBody>
        </Card>
      )}

      {data && (
        <div className={styles.layout}>
          <Card>
            <CardHeader title="Request details" />
            <CardBody>
              <DetailList items={detailItems} />
            </CardBody>
          </Card>

          <div className={styles.aside}>
            {data.decision && (
              <Card>
                <CardHeader title="Decision" />
                <CardBody>
                  <DetailList
                    stacked
                    items={[
                      { label: "Outcome", value: <StatusBadge status={data.decision.decision} /> },
                      ...(data.decision.reason
                        ? [{ label: "Reason", value: data.decision.reason, multiline: true }]
                        : []),
                      { label: "Decided", value: formatDateTime(data.decision.decidedAt) },
                    ]}
                  />
                </CardBody>
              </Card>
            )}

            {canDecide && (
              <Card>
                <CardHeader title="Decide" />
                <CardBody>
                  <div className={styles.stack}>
                    {actionError && (
                      <Alert variant="error" role="alert">
                        {actionError}
                      </Alert>
                    )}

                    {showRejectForm ? (
                      <form className={styles.rejectForm} onSubmit={handleRejectSubmit}>
                        <Field
                          htmlFor="reason"
                          label="Reason for rejection"
                          hint="Recorded with the decision and visible to the analyst who raised the request."
                        >
                          <Textarea
                            id="reason"
                            value={reason}
                            aria-describedby="reason-hint"
                            onChange={(event) => setReason(event.target.value)}
                            required
                          />
                        </Field>
                        <div className={styles.rejectActions}>
                          <Button variant="secondary" onClick={() => setShowRejectForm(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" variant="dangerSolid" disabled={rejectMutation.isPending}>
                            {rejectMutation.isPending ? "Rejecting..." : "Confirm rejection"}
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <p className={styles.decideIntro}>
                          A decision is final — a request can only leave PENDING once.
                        </p>
                        <div className={styles.decideActions}>
                          <Button variant="success" onClick={handleApprove} disabled={approveMutation.isPending}>
                            {approveMutation.isPending ? "Approving..." : "Approve"}
                          </Button>
                          <Button variant="danger" onClick={() => setShowRejectForm(true)}>
                            Reject
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </CardBody>
              </Card>
            )}

            {session?.role === "ANALYST" && data.status === "PENDING" && (
              <Alert variant="info">Only a supervisor can approve or reject this request.</Alert>
            )}
          </div>
        </div>
      )}
    </>
  );
}
