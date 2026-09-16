import { sql } from "drizzle-orm";
import {
  char,
  check,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 100 }).notNull(),
  role: text("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("users_role_check", sql`${table.role} IN ('ANALYST', 'SUPERVISOR')`),
]);

export const suppliers = pgTable("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  taxId: varchar("tax_id", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const disbursementRequests = pgTable("disbursement_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  externalReference: varchar("external_reference", { length: 100 }).notNull(),
  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  concept: text("concept").notNull(),
  status: text("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("uq_supplier_external_reference").on(table.supplierId, table.externalReference),
  check("disbursement_requests_status_check", sql`${table.status} IN ('PENDING', 'APPROVED', 'REJECTED')`),
  check("disbursement_requests_amount_check", sql`${table.amount} > 0`),
  index("idx_disbursement_requests_status").on(table.status),
  index("idx_disbursement_requests_supplier_id").on(table.supplierId),
]);

export const decisions = pgTable("decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").notNull().unique().references(() => disbursementRequests.id),
  decision: text("decision").notNull(),
  reason: text("reason"),
  decidedBy: uuid("decided_by").notNull().references(() => users.id),
  decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("decisions_decision_check", sql`${table.decision} IN ('APPROVED', 'REJECTED')`),
  check(
    "decisions_reason_required_on_reject_check",
    sql`${table.decision} <> 'REJECTED' OR (${table.reason} IS NOT NULL AND length(trim(${table.reason})) > 0)`,
  ),
]);
