import { asc } from "drizzle-orm";
import { Router } from "express";
import { db } from "../../db/client.js";
import { suppliers } from "../../db/schema.js";
import { requireAuth } from "../../middleware/auth.js";
import { captureRoutePath } from "../../middleware/requestLogger.js";

export const suppliersRouter = Router();

suppliersRouter.get("/", captureRoutePath, requireAuth, async (req, res) => {
  req.operation = "suppliers.list";

  const rows = await db
    .select({ id: suppliers.id, taxId: suppliers.taxId, name: suppliers.name })
    .from(suppliers)
    .orderBy(asc(suppliers.name));

  res.status(200).json(rows);
});
