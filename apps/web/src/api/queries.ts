import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type {
  CreateDisbursementRequestResponse,
  DisbursementRequestDetail,
  PaginatedRequests,
  RequestStatus,
  Supplier,
} from "./types";

// RF7 (TDD §14): a status change made from another session must show up
// here within ~10s without a full reload. Polling every 5s comfortably
// covers that, plus refetchOnWindowFocus (set globally in queryClient.ts)
// catches the common case of switching back to a tab immediately.
const POLL_INTERVAL_MS = 5000;

// Long staleTime: the seeded supplier list barely changes within a session,
// and there's no supplier CRUD UI to invalidate it from (TDD §5 assumption).
export function useSuppliersQuery() {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: () => apiFetch<Supplier[]>("/suppliers"),
    staleTime: 5 * 60 * 1000,
  });
}

export interface RequestsFilters {
  status?: RequestStatus;
  search?: string;
  page: number;
  pageSize: number;
}

function buildRequestsQueryString(filters: RequestsFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));
  return params.toString();
}

// Keyed by every filter param, so each filter/page combination caches
// independently (TDD §13) instead of one query clobbering another.
export function useRequestsQuery(filters: RequestsFilters) {
  return useQuery({
    queryKey: ["requests", filters],
    queryFn: () => apiFetch<PaginatedRequests>(`/disbursement-requests?${buildRequestsQueryString(filters)}`),
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useRequestQuery(id: string) {
  return useQuery({
    queryKey: ["requests", id],
    queryFn: () => apiFetch<DisbursementRequestDetail>(`/disbursement-requests/${id}`),
    enabled: Boolean(id),
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export interface CreateRequestInput {
  supplierId: string;
  externalReference: string;
  amount: string;
  currency: string;
  concept: string;
}

export function useCreateRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRequestInput) =>
      apiFetch<CreateDisbursementRequestResponse>("/disbursement-requests", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
    },
  });
}

interface DecideVariables {
  id: string;
  reason?: string;
}

function useDecideMutation(action: "approve" | "reject") {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: DecideVariables) =>
      apiFetch<DisbursementRequestDetail>(`/disbursement-requests/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify(action === "reject" ? { reason } : {}),
      }),
    onSuccess: (_data: DisbursementRequestDetail, variables: DecideVariables) => {
      // Both the list (status column) and this request's own detail cache
      // need to reflect the decision immediately (TDD §13/§14).
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
      void queryClient.invalidateQueries({ queryKey: ["requests", variables.id] });
    },
  });
}

export function useApproveMutation() {
  return useDecideMutation("approve");
}

export function useRejectMutation() {
  return useDecideMutation("reject");
}
