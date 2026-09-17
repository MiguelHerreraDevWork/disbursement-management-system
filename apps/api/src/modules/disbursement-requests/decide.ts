import { and, eq } from "drizzle-orm";
import type { Response } from "express";
import { db } from "../../db/client.js";
import { decisions, disbursementRequests, suppliers } from "../../db/schema.js";
import { ConflictError, NotFoundError, UnauthorizedError } from "../../lib/errors.js";
import { parseOrThrow } from "../../lib/validation.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { captureRoutePath } from "../../middleware/requestLogger.js";
import { disbursementRequestsRouter, requestListColumns } from "./disbursement-requests.routes.js";
import { disbursementRequestIdParamSchema, rejectRequestSchema } from "./schemas.js";

const decisionColumns = {
  id: decisions.id,
  decision: decisions.decision,
  reason: decisions.reason,
  decidedBy: decisions.decidedBy,
  decidedAt: decisions.decidedAt,
};

async function fetchRequestDetail(id: string) {
  const [row] = await db
    .select(requestListColumns)
    .from(disbursementRequests)
    .innerJoin(suppliers, eq(disbursementRequests.supplierId, suppliers.id))
    .where(eq(disbursementRequests.id, id))
    .limit(1);
  return row ?? null;
}

async function fetchDecision(requestId: string) {
  const [decision] = await db.select(decisionColumns).from(decisions).where(eq(decisions.requestId, requestId)).limit(1);
  return decision ?? null;
}

// §8: a single transaction per decide call. The conditional UPDATE's
// WHERE status = 'PENDING' *is* the check — evaluated atomically by
// Postgres as part of the same statement that performs the write, so there
// is no separate check-then-act race window. Whichever of two concurrent
// decide calls commits first wins; PostgreSQL re-evaluates the WHERE clause
// for the second one against the now-committed row, so it matches zero rows
// and returns null here (no decisions row is inserted for the loser).
async function attemptDecision(id: string, decisionValue: "APPROVED" | "REJECTED", reason: string | null, decidedBy: string) {
  return db.transaction(async (tx) => {
    const [updatedRow] = await tx
      .update(disbursementRequests)
      .set({ status: decisionValue, updatedAt: new Date() })
      .where(and(eq(disbursementRequests.id, id), eq(disbursementRequests.status, "PENDING")))
      .returning();

    if (!updatedRow) {
      return null;
    }

    // decisions.request_id UNIQUE is defense-in-depth: even if a future bug
    // let a second UPDATE slip through, a second insert here would violate
    // the constraint and roll back rather than silently double-decide.
    await tx.insert(decisions).values({ requestId: id, decision: decisionValue, reason, decidedBy });

    return updatedRow;
  });
}

async function handleDecision(
  res: Response,
  id: string,
  decisionValue: "APPROVED" | "REJECTED",
  reason: string | null,
  decidedBy: string,
) {
  const updatedRow = await attemptDecision(id, decisionValue, reason, decidedBy);

  if (!updatedRow) {
    const existingDetail = await fetchRequestDetail(id);
    if (!existingDetail) {
      throw new NotFoundError("Disbursement request not found", "REQUEST_NOT_FOUND");
    }

    const existingDecision = await fetchDecision(id);
    throw new ConflictError("This request has already been decided.", "REQUEST_ALREADY_DECIDED", {
      status: existingDetail.status,
      decision: existingDecision,
    });
  }

  const detail = await fetchRequestDetail(id);
  const decisionRow = await fetchDecision(id);

  res.status(200).json({ ...detail, decision: decisionRow });
}

disbursementRequestsRouter.post(
  "/:id/approve",
  captureRoutePath,
  requireAuth,
  requireRole("SUPERVISOR"),
  async (req, res) => {
    req.operation = "disbursementRequests.approve";

    const { id } = parseOrThrow(disbursementRequestIdParamSchema, req.params);
    if (!req.user) {
      throw new UnauthorizedError("Authentication required");
    }

    await handleDecision(res, id, "APPROVED", null, req.user.userId);
  },
);

disbursementRequestsRouter.post(
  "/:id/reject",
  captureRoutePath,
  requireAuth,
  requireRole("SUPERVISOR"),
  async (req, res) => {
    req.operation = "disbursementRequests.reject";

    const { id } = parseOrThrow(disbursementRequestIdParamSchema, req.params);
    const { reason } = parseOrThrow(rejectRequestSchema, req.body);
    if (!req.user) {
      throw new UnauthorizedError("Authentication required");
    }

    await handleDecision(res, id, "REJECTED", reason, req.user.userId);
  },
);
