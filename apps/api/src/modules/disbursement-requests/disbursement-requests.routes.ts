import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Router } from "express";
import { db } from "../../db/client.js";
import { decisions, disbursementRequests, suppliers } from "../../db/schema.js";
import { NotFoundError } from "../../lib/errors.js";
import { parseOrThrow } from "../../lib/validation.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { captureRoutePath } from "../../middleware/requestLogger.js";
import {
  createDisbursementRequestSchema,
  disbursementRequestIdParamSchema,
  listDisbursementRequestsQuerySchema,
} from "./schemas.js";

export const requestListColumns = {
  id: disbursementRequests.id,
  externalReference: disbursementRequests.externalReference,
  supplierId: disbursementRequests.supplierId,
  amount: disbursementRequests.amount,
  currency: disbursementRequests.currency,
  concept: disbursementRequests.concept,
  status: disbursementRequests.status,
  createdAt: disbursementRequests.createdAt,
  updatedAt: disbursementRequests.updatedAt,
  supplier: { id: suppliers.id, taxId: suppliers.taxId, name: suppliers.name },
};

type SupplierRow = typeof suppliers.$inferSelect;
type DisbursementRequestRow = typeof disbursementRequests.$inferSelect;

function serializeRequest(row: DisbursementRequestRow, supplier: SupplierRow) {
  return {
    id: row.id,
    externalReference: row.externalReference,
    supplierId: row.supplierId,
    supplier: { id: supplier.id, taxId: supplier.taxId, name: supplier.name },
    amount: row.amount,
    currency: row.currency,
    concept: row.concept,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const disbursementRequestsRouter = Router();

// RF1 + RF5: create is idempotent on (supplierId, externalReference) — a
// retried create returns the same resource instead of a duplicate row.
disbursementRequestsRouter.post("/", captureRoutePath, requireAuth, requireRole("ANALYST"), async (req, res) => {
  req.operation = "disbursementRequests.create";

  const body = parseOrThrow(createDisbursementRequestSchema, req.body);

  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, body.supplierId)).limit(1);

  if (!supplier) {
    throw new NotFoundError("Supplier not found", "SUPPLIER_NOT_FOUND");
  }

  const inserted = await db
    .insert(disbursementRequests)
    .values({
      supplierId: body.supplierId,
      externalReference: body.externalReference,
      amount: body.amount,
      currency: body.currency,
      concept: body.concept,
    })
    .onConflictDoNothing({
      target: [disbursementRequests.supplierId, disbursementRequests.externalReference],
    })
    .returning();

  const createdRow = inserted[0];
  if (createdRow) {
    res.status(201).json({ ...serializeRequest(createdRow, supplier), idempotentReplay: false });
    return;
  }

  const [existingRow] = await db
    .select()
    .from(disbursementRequests)
    .where(
      and(
        eq(disbursementRequests.supplierId, body.supplierId),
        eq(disbursementRequests.externalReference, body.externalReference),
      ),
    )
    .limit(1);

  if (!existingRow) {
    // Unreachable in practice: the insert only no-ops when a conflicting row
    // already exists, so the immediate re-fetch above should always find it.
    throw new Error("Idempotent replay lookup failed unexpectedly after an insert conflict");
  }

  res.status(200).json({ ...serializeRequest(existingRow, supplier), idempotentReplay: true });
});

// RF2 + §12: filter by status, search by supplier/reference, paginated —
// never loads the full history in one response.
disbursementRequestsRouter.get("/", captureRoutePath, requireAuth, async (req, res) => {
  req.operation = "disbursementRequests.list";

  const query = parseOrThrow(listDisbursementRequestsQuerySchema, req.query);

  const conditions = [];
  if (query.status) {
    conditions.push(eq(disbursementRequests.status, query.status));
  }
  if (query.search) {
    const pattern = `%${query.search}%`;
    conditions.push(or(ilike(disbursementRequests.externalReference, pattern), ilike(suppliers.name, pattern)));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (query.page - 1) * query.pageSize;

  const [items, totalResult] = await Promise.all([
    db
      .select(requestListColumns)
      .from(disbursementRequests)
      .innerJoin(suppliers, eq(disbursementRequests.supplierId, suppliers.id))
      .where(whereClause)
      .orderBy(desc(disbursementRequests.createdAt))
      .limit(query.pageSize)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(disbursementRequests)
      .innerJoin(suppliers, eq(disbursementRequests.supplierId, suppliers.id))
      .where(whereClause),
  ]);

  const total = totalResult[0]?.total ?? 0;

  res.status(200).json({
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.ceil(total / query.pageSize),
  });
});

// RF3: full detail, including the decision if the request has already been
// decided (see decide.ts for how a request transitions to APPROVED/REJECTED).
disbursementRequestsRouter.get("/:id", captureRoutePath, requireAuth, async (req, res) => {
  req.operation = "disbursementRequests.detail";

  const { id } = parseOrThrow(disbursementRequestIdParamSchema, req.params);

  const [row] = await db
    .select(requestListColumns)
    .from(disbursementRequests)
    .innerJoin(suppliers, eq(disbursementRequests.supplierId, suppliers.id))
    .where(eq(disbursementRequests.id, id))
    .limit(1);

  if (!row) {
    throw new NotFoundError("Disbursement request not found", "REQUEST_NOT_FOUND");
  }

  const [decision] = await db
    .select({
      id: decisions.id,
      decision: decisions.decision,
      reason: decisions.reason,
      decidedBy: decisions.decidedBy,
      decidedAt: decisions.decidedAt,
    })
    .from(decisions)
    .where(eq(decisions.requestId, id))
    .limit(1);

  res.status(200).json({ ...row, decision: decision ?? null });
});
