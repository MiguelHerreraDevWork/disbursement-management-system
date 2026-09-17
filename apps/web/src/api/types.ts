export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type DecisionValue = "APPROVED" | "REJECTED";

export interface Supplier {
  id: string;
  taxId: string;
  name: string;
}

export interface Decision {
  id: string;
  decision: DecisionValue;
  reason: string | null;
  decidedBy: string;
  decidedAt: string;
}

export interface DisbursementRequestSummary {
  id: string;
  externalReference: string;
  supplierId: string;
  supplier: Supplier;
  amount: string;
  currency: string;
  concept: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DisbursementRequestDetail extends DisbursementRequestSummary {
  decision: Decision | null;
}

export interface CreateDisbursementRequestResponse extends DisbursementRequestSummary {
  idempotentReplay: boolean;
}

export interface PaginatedRequests {
  items: DisbursementRequestSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
