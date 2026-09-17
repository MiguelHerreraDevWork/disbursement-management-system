import { z } from "zod";

export const createDisbursementRequestSchema = z.object({
  supplierId: z.string().uuid("supplierId must be a valid UUID"),
  externalReference: z.string().trim().min(1, "externalReference is required").max(100),
  amount: z
    .string()
    .regex(/^\d{1,12}(\.\d{1,2})?$/, "amount must be a decimal string with up to 2 decimal places")
    .refine((value) => Number(value) > 0, "amount must be greater than 0"),
  currency: z.string().regex(/^[A-Z]{3}$/, "currency must be a 3-letter uppercase ISO 4217 code"),
  concept: z.string().trim().min(1, "concept is required").max(2000),
});

export const listDisbursementRequestsQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const disbursementRequestIdParamSchema = z.object({
  id: z.string().uuid("id must be a valid UUID"),
});

export const rejectRequestSchema = z.object({
  reason: z.string().trim().min(1, "reason is required when rejecting").max(1000),
});
