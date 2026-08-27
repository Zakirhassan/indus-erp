/**
 * Drizzle schema — mirrors packages/shared-types/src/{models,enums}.ts 1:1.
 * All money columns are integer paise (never floats) per @indus/shared-types money.ts.
 */
import { relations } from "drizzle-orm";
import { boolean, integer, pgEnum, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["ADMIN", "COLLECTOR"]);
export const relationEnum = pgEnum("relation", ["S/O", "D/O", "W/O", "F/O", "H/O", "C/O"]);
export const occurrenceEnum = pgEnum("occurrence", ["DAILY", "WEEKLY", "MONTHLY"]);
export const customerStatusEnum = pgEnum("customer_status", ["ACTIVE", "INACTIVE"]);
export const ledgerEntryTypeEnum = pgEnum("ledger_entry_type", ["SALE", "COLLECTION", "RETURN"]);
export const inventoryTxnTypeEnum = pgEnum("inventory_txn_type", [
  "PURCHASE_IN",
  "SALE_OUT",
  "RETURN_IN",
  "ADJUSTMENT",
]);
export const collectionBatchStatusEnum = pgEnum("collection_batch_status", [
  "DRAFT",
  "PENDING",
  "VERIFIED",
  "APPROVED",
  "REJECTED",
]);
export const customerApprovalStatusEnum = pgEnum("customer_approval_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const fields = pgTable("fields", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description").notNull(),
  active: boolean("active").notNull().default(true),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
});

export const userFields = pgTable(
  "user_fields",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    fieldId: text("field_id")
      .notNull()
      .references(() => fields.id),
  },
  (table) => [primaryKey({ columns: [table.userId, table.fieldId] })],
);

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  pricePaise: integer("price_paise").notNull(),
  costPricePaise: integer("cost_price_paise"),
  quantity: integer("quantity").notNull(),
  createdAt: text("created_at").notNull(),
});

export const inventoryTransactions = pgTable("inventory_transactions", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  type: inventoryTxnTypeEnum("type").notNull(),
  quantityDelta: integer("quantity_delta").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  referenceId: text("reference_id"),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});

// customers.sale_id and sales.customer_id conceptually reference each other
// (one active sale per customer). To avoid a same-file circular FK between
// the two tables, only sales.customer_id carries a real DB-level FK;
// customers.sale_id is a plain nullable column, backfilled by application
// code right after the sale row is inserted (see createCustomer transaction).
export const customers = pgTable("customers", {
  id: text("id").primaryKey(),
  fieldId: text("field_id")
    .notNull()
    .references(() => fields.id),
  fieldCode: text("field_code").notNull(),
  serialNo: integer("serial_no").notNull(),
  name: text("name").notNull(),
  relation: relationEnum("relation").notNull(),
  relationName: text("relation_name").notNull(),
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  aadhaarLast4: text("aadhaar_last4"),
  notes: text("notes"),
  status: customerStatusEnum("status").notNull(),
  saleId: text("sale_id"),
  approvalStatus: customerApprovalStatusEnum("approval_status").notNull().default("APPROVED"),
  submittedBy: text("submitted_by").references(() => users.id),
  submittedByName: text("submitted_by_name"),
  createdAt: text("created_at").notNull(),
});

export const sales = pgTable("sales", {
  id: text("id").primaryKey(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id),
  totalPaise: integer("total_paise").notNull(),
  discountPaise: integer("discount_paise").notNull(),
  finalAmountPaise: integer("final_amount_paise").notNull(),
  advancePaise: integer("advance_paise").notNull(),
  balancePaise: integer("balance_paise").notNull(),
  occurrence: occurrenceEnum("occurrence").notNull(),
  financeAmountPaise: integer("finance_amount_paise").notNull(),
  durationCount: integer("duration_count").notNull(),
  regularInstallmentPaise: integer("regular_installment_paise").notNull(),
  finalInstallmentPaise: integer("final_installment_paise").notNull(),
  saleDate: text("sale_date").notNull(),
  createdAt: text("created_at").notNull(),
});

export const saleItems = pgTable("sale_items", {
  id: text("id").primaryKey(),
  saleId: text("sale_id")
    .notNull()
    .references(() => sales.id),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  productName: text("product_name").notNull(),
  masterPricePaise: integer("master_price_paise").notNull(),
  adjustedPricePaise: integer("adjusted_price_paise").notNull(),
  quantity: integer("quantity").notNull(),
  subtotalPaise: integer("subtotal_paise").notNull(),
});

export const ledgerEntries = pgTable("ledger_entries", {
  id: text("id").primaryKey(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id),
  saleId: text("sale_id")
    .notNull()
    .references(() => sales.id),
  date: text("date").notNull(),
  type: ledgerEntryTypeEnum("type").notNull(),
  debitPaise: integer("debit_paise").notNull(),
  creditPaise: integer("credit_paise").notNull(),
  balanceAfterPaise: integer("balance_after_paise").notNull(),
  collectedBy: text("collected_by"),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});

export const collectionBatches = pgTable("collection_batches", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  fieldId: text("field_id")
    .notNull()
    .references(() => fields.id),
  fieldCode: text("field_code").notNull(),
  collectorId: text("collector_id").references(() => users.id),
  collectorName: text("collector_name"),
  totalAmountPaise: integer("total_amount_paise").notNull(),
  status: collectionBatchStatusEnum("status").notNull(),
  createdAt: text("created_at").notNull(),
  // Set once, never cleared, when an admin reopens an already-submitted batch for
  // correction. Marks it permanently as "corrected" and excludes it from the
  // day-close gate while it sits DRAFT again (see listUnsubmittedPriorDayBatches).
  reopenedAt: text("reopened_at"),
  reopenedByName: text("reopened_by_name"),
});

export const collectionEntries = pgTable("collection_entries", {
  id: text("id").primaryKey(),
  batchId: text("batch_id")
    .notNull()
    .references(() => collectionBatches.id),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id),
  serialNo: integer("serial_no").notNull(),
  amountPaise: integer("amount_paise").notNull(),
  error: text("error"),
});

/**
 * Every mutating request across the API, recorded automatically by
 * services/api/src/auditMiddleware.ts. requestBody/responseBody are
 * JSON-stringified and size-capped; sensitive keys (password, token) are
 * redacted before insert.
 */
export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").references(() => users.id),
  actorRole: text("actor_role"),
  method: text("method").notNull(),
  path: text("path").notNull(),
  statusCode: integer("status_code").notNull(),
  requestBody: text("request_body"),
  responseBody: text("response_body"),
  createdAt: text("created_at").notNull(),
});

export const returns = pgTable("returns", {
  id: text("id").primaryKey(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id),
  saleId: text("sale_id")
    .notNull()
    .references(() => sales.id),
  advanceRefundedPaise: integer("advance_refunded_paise").notNull(),
  returnedAt: text("returned_at").notNull(),
  reason: text("reason"),
  note: text("note"),
});

export const customersRelations = relations(customers, ({ one, many }) => ({
  field: one(fields, { fields: [customers.fieldId], references: [fields.id] }),
  sale: one(sales, { fields: [customers.saleId], references: [sales.id] }),
  ledgerEntries: many(ledgerEntries),
}));

export const salesRelations = relations(sales, ({ many }) => ({
  items: many(saleItems),
}));
