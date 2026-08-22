CREATE TYPE "public"."collection_batch_status" AS ENUM('PENDING', 'VERIFIED', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."customer_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."inventory_txn_type" AS ENUM('PURCHASE_IN', 'SALE_OUT', 'RETURN_IN', 'ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('SALE', 'COLLECTION', 'RETURN');--> statement-breakpoint
CREATE TYPE "public"."occurrence" AS ENUM('DAILY', 'WEEKLY', 'MONTHLY');--> statement-breakpoint
CREATE TYPE "public"."relation" AS ENUM('S/O', 'D/O', 'W/O', 'F/O', 'H/O', 'C/O');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('ADMIN', 'COLLECTOR');--> statement-breakpoint
CREATE TABLE "collection_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"field_id" text NOT NULL,
	"field_code" text NOT NULL,
	"collector_id" text,
	"collector_name" text,
	"total_amount_paise" integer NOT NULL,
	"status" "collection_batch_status" NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"batch_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"serial_no" integer NOT NULL,
	"amount_paise" integer NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"field_id" text NOT NULL,
	"field_code" text NOT NULL,
	"serial_no" integer NOT NULL,
	"name" text NOT NULL,
	"relation" "relation" NOT NULL,
	"relation_name" text NOT NULL,
	"address" text NOT NULL,
	"phone" text NOT NULL,
	"aadhaar_last4" text,
	"notes" text,
	"status" "customer_status" NOT NULL,
	"sale_id" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fields" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "fields_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "inventory_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"type" "inventory_txn_type" NOT NULL,
	"quantity_delta" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reference_id" text,
	"note" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"sale_id" text NOT NULL,
	"date" text NOT NULL,
	"type" "ledger_entry_type" NOT NULL,
	"debit_paise" integer NOT NULL,
	"credit_paise" integer NOT NULL,
	"balance_after_paise" integer NOT NULL,
	"collected_by" text,
	"note" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"price_paise" integer NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "returns" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"sale_id" text NOT NULL,
	"advance_refunded_paise" integer NOT NULL,
	"returned_at" text NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" text PRIMARY KEY NOT NULL,
	"sale_id" text NOT NULL,
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"master_price_paise" integer NOT NULL,
	"adjusted_price_paise" integer NOT NULL,
	"quantity" integer NOT NULL,
	"subtotal_paise" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"total_paise" integer NOT NULL,
	"discount_paise" integer NOT NULL,
	"final_amount_paise" integer NOT NULL,
	"advance_paise" integer NOT NULL,
	"balance_paise" integer NOT NULL,
	"occurrence" "occurrence" NOT NULL,
	"finance_amount_paise" integer NOT NULL,
	"duration_count" integer NOT NULL,
	"regular_installment_paise" integer NOT NULL,
	"final_installment_paise" integer NOT NULL,
	"sale_date" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_fields" (
	"user_id" text NOT NULL,
	"field_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" NOT NULL,
	"last_active_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "collection_batches" ADD CONSTRAINT "collection_batches_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_batches" ADD CONSTRAINT "collection_batches_collector_id_users_id_fk" FOREIGN KEY ("collector_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_entries" ADD CONSTRAINT "collection_entries_batch_id_collection_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."collection_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_entries" ADD CONSTRAINT "collection_entries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_fields" ADD CONSTRAINT "user_fields_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_fields" ADD CONSTRAINT "user_fields_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE no action ON UPDATE no action;