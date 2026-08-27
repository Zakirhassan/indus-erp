import type {
  CollectionBatchStatus,
  CustomerApprovalStatus,
  CustomerStatus,
  InventoryTxnType,
  LedgerEntryType,
  Occurrence,
  Relation,
  Role,
} from "./enums.js";
import type { Paise } from "./money.js";

export interface FieldRoute {
  id: string;
  code: string; // e.g. "C1", "D1", "D2", "E1"
  description: string; // e.g. "North District - Commercial"
  active: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  fieldIds: string[]; // fields this user (collector) is assigned to; empty for admin (all)
  lastActiveAt: string | null; // ISO timestamp
}

export interface Product {
  id: string;
  name: string;
  type: string; // e.g. "Bed", "Almirah", "Table", "Sofa", "Household Item"
  pricePaise: Paise; // current master price (selling price)
  costPricePaise: Paise | null; // shop's buy-in cost; null if not yet recorded — profit reports exclude items with no cost on file
  quantity: number; // current stock on hand
  createdAt: string;
}

export interface InventoryTransaction {
  id: string;
  productId: string;
  type: InventoryTxnType;
  quantityDelta: number; // positive for stock-in, negative for stock-out
  balanceAfter: number;
  referenceId: string | null; // sale id / return id / purchase order id
  note: string | null;
  createdAt: string;
}

export interface SaleItem {
  productId: string;
  productName: string; // denormalized snapshot at time of sale
  masterPricePaise: Paise; // product master price at time of sale
  adjustedPricePaise: Paise; // session-only adjusted price — never written back to Product
  quantity: number;
  subtotalPaise: Paise; // adjustedPricePaise * quantity
}

export interface FinancePlan {
  occurrence: Occurrence;
  financeAmountPaise: Paise; // target per-installment amount
  durationCount: number; // derived number of occurrences to clear the balance
  regularInstallmentPaise: Paise;
  finalInstallmentPaise: Paise;
}

export interface Sale {
  id: string;
  customerId: string;
  items: SaleItem[];
  totalPaise: Paise; // sum of subtotals before discount
  discountPaise: Paise;
  finalAmountPaise: Paise; // totalPaise - discountPaise
  advancePaise: Paise;
  balancePaise: Paise; // finalAmountPaise - advancePaise, decreases as collections post
  financePlan: FinancePlan;
  saleDate: string; // ISO date, "purchase date"
  createdAt: string;
}

export interface Customer {
  id: string;
  fieldId: string;
  fieldCode: string; // denormalized, e.g. "C1"
  serialNo: number; // unique within (fieldId), NOT globally unique
  name: string;
  relation: Relation;
  relationName: string;
  address: string;
  phone: string;
  aadhaarLast4: string | null; // masked; full value never held client-side
  notes: string | null;
  status: CustomerStatus;
  saleId: string; // the customer's active sale (one active sale per customer in this build)
  approvalStatus: CustomerApprovalStatus; // PENDING when submitted by a collector from the vendor app; APPROVED when entered directly in admin-web
  submittedBy: string | null; // collector user id, null when entered directly by the shop owner in admin-web
  submittedByName: string | null;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  customerId: string;
  saleId: string;
  date: string; // ISO date
  type: LedgerEntryType;
  debitPaise: Paise; // amount added to what's owed (sale, or 0 for collection/return)
  creditPaise: Paise; // amount paid off (collection amount, or return reversal)
  balanceAfterPaise: Paise;
  collectedBy: string | null; // user id/name, for COLLECTION entries
  note: string | null; // e.g. "Online Payment", "Given on Shop"
  createdAt: string;
}

export interface CollectionEntry {
  id: string;
  batchId: string;
  customerId: string;
  serialNo: number;
  amountPaise: Paise;
  error: string | null; // inline validation error, e.g. "exceeds balance"
}

export interface CollectionBatch {
  id: string;
  date: string; // ISO date
  fieldId: string;
  fieldCode: string;
  collectorId: string | null; // null when entered directly by the shop owner in admin-web
  collectorName: string | null;
  entries: CollectionEntry[];
  totalAmountPaise: Paise;
  status: CollectionBatchStatus;
  createdAt: string;
  reopenedAt: string | null;
  reopenedByName: string | null;
}

export interface ReturnRecord {
  id: string;
  customerId: string;
  saleId: string;
  advanceRefundedPaise: Paise;
  returnedAt: string;
  reason: string | null;
  note: string | null;
}
