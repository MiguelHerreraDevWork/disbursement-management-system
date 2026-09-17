import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { ApiError } from "../api/client";
import { useCreateRequestMutation, useSuppliersQuery } from "../api/queries";
import { Alert } from "../components/Alert";
import { Button, buttonClassName } from "../components/Button";
import { Card, CardBody, CardFooter } from "../components/Card";
import { Field } from "../components/Field";
import { Input } from "../components/Input";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { Select } from "../components/Select";
import { Textarea } from "../components/Textarea";
import { cx } from "../lib/cx";
import styles from "./NewRequestPage.module.css";

// UX-only validation to give immediate feedback — the server (Zod on the
// backend) is the authoritative validator regardless of what passes here.
const createRequestFormSchema = z.object({
  supplierId: z.string().uuid("Select a supplier"),
  externalReference: z.string().trim().min(1, "External reference is required").max(100),
  amount: z
    .string()
    .regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter a valid amount (up to 2 decimal places)")
    .refine((value) => Number(value) > 0, "Amount must be greater than 0"),
  currency: z.string().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code (e.g. USD)"),
  concept: z.string().trim().min(1, "Concept is required").max(2000),
});

type FieldErrors = Partial<Record<keyof z.infer<typeof createRequestFormSchema>, string>>;

// aria-describedby has to point at the hint, the error, or both — whichever
// the field is currently rendering.
function describedBy(id: string, hasHint: boolean, hasError: boolean) {
  return cx(hasHint && `${id}-hint`, hasError && `${id}-error`) || undefined;
}

export function NewRequestPage() {
  const navigate = useNavigate();
  const suppliersQuery = useSuppliersQuery();
  const createMutation = useCreateRequestMutation();

  const [supplierId, setSupplierId] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("");
  const [concept, setConcept] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const result = createRequestFormSchema.safeParse({
      supplierId,
      externalReference,
      amount,
      currency,
      concept,
    });

    if (!result.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !(key in nextErrors)) {
          nextErrors[key as keyof FieldErrors] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});

    try {
      const created = await createMutation.mutateAsync(result.data);
      navigate(`/requests/${created.id}`, { replace: true });
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="New disbursement request"
        backTo="/requests"
        backLabel="Back to requests"
        description="The request is created as PENDING and stays that way until a supervisor decides on it."
      />

      <Card>
        {suppliersQuery.isLoading && <LoadingState label="Loading suppliers..." />}

        {suppliersQuery.isError && (
          <CardBody>
            <Alert
              variant="error"
              role="alert"
              title="Could not load suppliers"
              actions={
                <Button variant="secondary" size="sm" onClick={() => suppliersQuery.refetch()}>
                  Retry
                </Button>
              }
            >
              A supplier is required to create a request, so the form is unavailable until this loads.
            </Alert>
          </CardBody>
        )}

        {suppliersQuery.data && (
          <form onSubmit={handleSubmit} noValidate>
            <CardBody>
              <div className={styles.form}>
                <Field htmlFor="supplierId" label="Supplier" error={fieldErrors.supplierId}>
                  <Select
                    id="supplierId"
                    value={supplierId}
                    invalid={Boolean(fieldErrors.supplierId)}
                    aria-describedby={describedBy("supplierId", false, Boolean(fieldErrors.supplierId))}
                    onChange={(event) => setSupplierId(event.target.value)}
                  >
                    <option value="">Select a supplier</option>
                    {suppliersQuery.data.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name} ({supplier.taxId})
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  htmlFor="externalReference"
                  label="External reference"
                  hint="Your own identifier for this request. Re-sending the same reference for the same supplier returns the original request instead of creating a duplicate."
                  error={fieldErrors.externalReference}
                >
                  <Input
                    id="externalReference"
                    type="text"
                    maxLength={100}
                    value={externalReference}
                    invalid={Boolean(fieldErrors.externalReference)}
                    aria-describedby={describedBy("externalReference", true, Boolean(fieldErrors.externalReference))}
                    onChange={(event) => setExternalReference(event.target.value)}
                  />
                </Field>

                <div className={styles.row}>
                  <Field htmlFor="amount" label="Amount" hint="Up to 2 decimals." error={fieldErrors.amount}>
                    <Input
                      id="amount"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amount}
                      invalid={Boolean(fieldErrors.amount)}
                      aria-describedby={describedBy("amount", true, Boolean(fieldErrors.amount))}
                      onChange={(event) => setAmount(event.target.value)}
                    />
                  </Field>

                  <Field htmlFor="currency" label="Currency" hint="3-letter code." error={fieldErrors.currency}>
                    <Input
                      id="currency"
                      type="text"
                      maxLength={3}
                      placeholder="USD"
                      value={currency}
                      invalid={Boolean(fieldErrors.currency)}
                      aria-describedby={describedBy("currency", true, Boolean(fieldErrors.currency))}
                      onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                    />
                  </Field>
                </div>

                <Field
                  htmlFor="concept"
                  label="Concept"
                  hint="What this disbursement is for."
                  error={fieldErrors.concept}
                >
                  <Textarea
                    id="concept"
                    maxLength={2000}
                    value={concept}
                    invalid={Boolean(fieldErrors.concept)}
                    aria-describedby={describedBy("concept", true, Boolean(fieldErrors.concept))}
                    onChange={(event) => setConcept(event.target.value)}
                  />
                </Field>

                {submitError && (
                  <Alert variant="error" role="alert" title="Could not create the request">
                    {submitError}
                  </Alert>
                )}
              </div>
            </CardBody>

            <CardFooter>
              <div className={styles.actions}>
                <Link to="/requests" className={buttonClassName({ variant: "secondary" })}>
                  Cancel
                </Link>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create request"}
                </Button>
              </div>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
