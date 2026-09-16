CREATE TABLE "decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"reason" text,
	"decided_by" uuid NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "decisions_request_id_unique" UNIQUE("request_id"),
	CONSTRAINT "decisions_decision_check" CHECK ("decisions"."decision" IN ('APPROVED', 'REJECTED')),
	CONSTRAINT "decisions_reason_required_on_reject_check" CHECK ("decisions"."decision" <> 'REJECTED' OR ("decisions"."reason" IS NOT NULL AND length(trim("decisions"."reason")) > 0))
);
--> statement-breakpoint
CREATE TABLE "disbursement_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_reference" varchar(100) NOT NULL,
	"supplier_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" char(3) NOT NULL,
	"concept" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_supplier_external_reference" UNIQUE("supplier_id","external_reference"),
	CONSTRAINT "disbursement_requests_status_check" CHECK ("disbursement_requests"."status" IN ('PENDING', 'APPROVED', 'REJECTED')),
	CONSTRAINT "disbursement_requests_amount_check" CHECK ("disbursement_requests"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tax_id" varchar(32) NOT NULL,
	"name" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_tax_id_unique" UNIQUE("tax_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(50) NOT NULL,
	"password_hash" varchar(100) NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_role_check" CHECK ("users"."role" IN ('ANALYST', 'SUPERVISOR'))
);
--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_request_id_disbursement_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."disbursement_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disbursement_requests" ADD CONSTRAINT "disbursement_requests_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_disbursement_requests_status" ON "disbursement_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_disbursement_requests_supplier_id" ON "disbursement_requests" USING btree ("supplier_id");