export const Occurrence = {
  Daily: "DAILY",
  Weekly: "WEEKLY",
  Monthly: "MONTHLY",
} as const;
export type Occurrence = (typeof Occurrence)[keyof typeof Occurrence];

export const CustomerStatus = {
  Active: "ACTIVE",
  Inactive: "INACTIVE",
} as const;
export type CustomerStatus = (typeof CustomerStatus)[keyof typeof CustomerStatus];

export const LedgerEntryType = {
  Sale: "SALE",
  Collection: "COLLECTION",
  Return: "RETURN",
} as const;
export type LedgerEntryType = (typeof LedgerEntryType)[keyof typeof LedgerEntryType];

export const InventoryTxnType = {
  PurchaseIn: "PURCHASE_IN",
  SaleOut: "SALE_OUT",
  ReturnIn: "RETURN_IN",
  Adjustment: "ADJUSTMENT",
} as const;
export type InventoryTxnType = (typeof InventoryTxnType)[keyof typeof InventoryTxnType];

export const Role = {
  Admin: "ADMIN",
  Collector: "COLLECTOR",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const CollectionBatchStatus = {
  Pending: "PENDING",
  Verified: "VERIFIED",
  Approved: "APPROVED",
  Rejected: "REJECTED",
} as const;
export type CollectionBatchStatus =
  (typeof CollectionBatchStatus)[keyof typeof CollectionBatchStatus];

export const CustomerApprovalStatus = {
  Pending: "PENDING",
  Approved: "APPROVED",
  Rejected: "REJECTED",
} as const;
export type CustomerApprovalStatus =
  (typeof CustomerApprovalStatus)[keyof typeof CustomerApprovalStatus];

export const Relation = {
  SonOf: "S/O",
  DaughterOf: "D/O",
  WifeOf: "W/O",
  FatherOf: "F/O",
  HusbandOf: "H/O",
  CareOf: "C/O",
} as const;
export type Relation = (typeof Relation)[keyof typeof Relation];
