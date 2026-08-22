import {
  CollectionBatchStatus,
  CustomerApprovalStatus,
  CustomerStatus,
  InventoryTxnType,
  LedgerEntryType,
  Role,
  planFromInstallmentAmount,
  type Customer,
  type CollectionBatch,
  type CollectionEntry,
  type FieldRoute,
  type InventoryTransaction,
  type LedgerEntry,
  type Product,
  type Sale,
  type SaleItem,
  type User,
} from "@indus/shared-types";
import { getDb, mutate, resetDb } from "./store";
import { clearSession, getSession, setSession, type Session } from "./session";

function delay(ms = 220) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function genId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function requireAdminName(): string {
  const session = getSession();
  return session?.name ?? "Shop Owner";
}

export interface Page<T> {
  items: T[];
  total: number;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

const DEMO_CREDENTIALS: Record<string, string> = {
  "admin@proledger.local": "admin123",
  "rambabu@proledger.local": "collector123",
  "mkane@proledger.local": "collector123",
};

export async function login(email: string, password: string): Promise<Session> {
  await delay(350);
  const normalized = email.trim().toLowerCase();
  const expected = DEMO_CREDENTIALS[normalized];
  const user = getDb().users.find((u) => u.email.toLowerCase() === normalized);
  if (!user || !expected || expected !== password) {
    throw new Error("Incorrect email or password.");
  }
  const session: Session = {
    token: genId("tok"),
    userId: user.id,
    name: user.name,
    role: user.role,
  };
  setSession(session);
  mutate((db) => {
    const u = db.users.find((x) => x.id === user.id);
    if (u) u.lastActiveAt = new Date().toISOString();
  });
  return session;
}

export function logout() {
  clearSession();
}

export function currentSession(): Session | null {
  return getSession();
}

export async function devResetDemoData(): Promise<void> {
  await delay(200);
  resetDb();
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

export async function listFields(): Promise<FieldRoute[]> {
  await delay();
  return [...getDb().fields];
}

export async function upsertField(input: { id?: string; code: string; description: string; active: boolean }): Promise<FieldRoute> {
  await delay();
  return mutate((db) => {
    if (input.id) {
      const f = db.fields.find((x) => x.id === input.id);
      if (!f) throw new Error("Field not found");
      f.code = input.code;
      f.description = input.description;
      f.active = input.active;
      return f;
    }
    const f: FieldRoute = { id: genId("field"), code: input.code, description: input.description, active: input.active };
    db.fields.push(f);
    return f;
  });
}

// ---------------------------------------------------------------------------
// Users (Settings > User Management)
// ---------------------------------------------------------------------------

export async function listUsers(): Promise<User[]> {
  await delay();
  return [...getDb().users];
}

export async function inviteUser(input: { name: string; email: string; role: Role; fieldIds: string[] }): Promise<User> {
  await delay();
  return mutate((db) => {
    const u: User = { id: genId("user"), name: input.name, email: input.email, role: input.role, fieldIds: input.fieldIds, lastActiveAt: null };
    db.users.push(u);
    return u;
  });
}

// ---------------------------------------------------------------------------
// Products / Inventory
// ---------------------------------------------------------------------------

export interface ListProductsParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listProducts(params: ListProductsParams = {}): Promise<Page<Product>> {
  await delay();
  const { search = "", page = 1, pageSize = 20 } = params;
  let items = [...getDb().products];
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    items = items.filter((p) => p.name.toLowerCase().includes(q) || p.type.toLowerCase().includes(q));
  }
  const total = items.length;
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total };
}

export async function getProduct(id: string): Promise<Product | undefined> {
  await delay();
  return getDb().products.find((p) => p.id === id);
}

export async function createProduct(input: { name: string; type: string; pricePaise: number; costPricePaise?: number; quantity: number }): Promise<Product> {
  await delay();
  return mutate((db) => {
    const p: Product = {
      id: genId("prod"),
      name: input.name,
      type: input.type,
      pricePaise: input.pricePaise,
      costPricePaise: input.costPricePaise ?? null,
      quantity: input.quantity,
      createdAt: todayIso(),
    };
    db.products.push(p);
    if (input.quantity > 0) {
      db.inventoryTxns.push({
        id: genId("itxn"),
        productId: p.id,
        type: InventoryTxnType.PurchaseIn,
        quantityDelta: input.quantity,
        balanceAfter: input.quantity,
        referenceId: null,
        note: "Initial stock on product creation",
        createdAt: todayIso(),
      });
    }
    return p;
  });
}

export async function updateProduct(id: string, patch: { name?: string; type?: string; pricePaise?: number }): Promise<Product> {
  await delay();
  return mutate((db) => {
    const p = db.products.find((x) => x.id === id);
    if (!p) throw new Error("Product not found");
    if (patch.name !== undefined) p.name = patch.name;
    if (patch.type !== undefined) p.type = patch.type;
    if (patch.pricePaise !== undefined) p.pricePaise = patch.pricePaise;
    return p;
  });
}

export async function purchaseIn(productId: string, quantity: number, note?: string): Promise<Product> {
  await delay();
  if (quantity <= 0) throw new Error("Quantity must be positive");
  return mutate((db) => {
    const p = db.products.find((x) => x.id === productId);
    if (!p) throw new Error("Product not found");
    p.quantity += quantity;
    db.inventoryTxns.push({
      id: genId("itxn"),
      productId,
      type: InventoryTxnType.PurchaseIn,
      quantityDelta: quantity,
      balanceAfter: p.quantity,
      referenceId: null,
      note: note ?? "Purchase order — stock in",
      createdAt: todayIso(),
    });
    return p;
  });
}

export async function listInventoryTxns(productId: string): Promise<InventoryTransaction[]> {
  await delay();
  return getDb()
    .inventoryTxns.filter((t) => t.productId === productId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export interface ListCustomersParams {
  search?: string;
  fieldId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface CustomerListRow extends Customer {
  purchaseDate: string;
  productsSummary: string;
  occurrence: Sale["financePlan"]["occurrence"];
  financeAmountPaise: number;
  finalAmountPaise: number;
  advancePaise: number;
  balancePaise: number;
}

export async function listCustomers(params: ListCustomersParams = {}): Promise<Page<CustomerListRow>> {
  await delay();
  const db = getDb();
  const { search = "", fieldId, dateFrom, dateTo, page = 1, pageSize = 15 } = params;
  let items = [...db.customers];
  if (fieldId) items = items.filter((c) => c.fieldId === fieldId);
  if (dateFrom) items = items.filter((c) => c.createdAt >= dateFrom);
  if (dateTo) items = items.filter((c) => c.createdAt <= dateTo);
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    items = items.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.relationName.toLowerCase().includes(q) ||
        `${c.fieldCode}-${c.serialNo}`.toLowerCase().includes(q) ||
        String(c.serialNo).includes(q),
    );
  }
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const total = items.length;
  const start = (page - 1) * pageSize;
  const rows: CustomerListRow[] = items.slice(start, start + pageSize).map((c) => {
    const sale = db.sales.find((s) => s.id === c.saleId)!;
    return {
      ...c,
      purchaseDate: sale.saleDate,
      productsSummary: sale.items.map((i) => `${i.productName} x${i.quantity}`).join(", "),
      occurrence: sale.financePlan.occurrence,
      financeAmountPaise: sale.financePlan.financeAmountPaise,
      finalAmountPaise: sale.finalAmountPaise,
      advancePaise: sale.advancePaise,
      balancePaise: sale.balancePaise,
    };
  });
  return { items: rows, total };
}

export interface CustomerWithSale {
  customer: Customer;
  sale: Sale;
}

export async function getCustomer(id: string): Promise<CustomerWithSale | undefined> {
  await delay();
  const db = getDb();
  const customer = db.customers.find((c) => c.id === id);
  if (!customer) return undefined;
  const sale = db.sales.find((s) => s.id === customer.saleId)!;
  return { customer, sale };
}

export async function getCustomerLedger(id: string): Promise<LedgerEntry[]> {
  await delay();
  return getDb()
    .ledgerEntries.filter((e) => e.customerId === id)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

export interface CreateCustomerInput {
  fieldId: string;
  purchaseDate: string;
  name: string;
  relation: Customer["relation"];
  relationName: string;
  address: string;
  phone: string;
  aadhaarLast4?: string;
  notes?: string;
  items: { productId: string; adjustedPricePaise: number; quantity: number }[];
  discountPaise: number;
  advancePaise: number;
  occurrence: Sale["financePlan"]["occurrence"];
  financeAmountPaise: number;
}

export async function createCustomer(input: CreateCustomerInput): Promise<CustomerWithSale> {
  await delay(350);
  return mutate((db) => {
    const field = db.fields.find((f) => f.id === input.fieldId);
    if (!field) throw new Error("Field not found");
    if (input.items.length === 0) throw new Error("At least one product is required");

    const existingSerials = db.customers.filter((c) => c.fieldId === field.id).map((c) => c.serialNo);
    const serialNo = existingSerials.length ? Math.max(...existingSerials) + 1 : 1;

    const items: SaleItem[] = input.items.map((it) => {
      const product = db.products.find((p) => p.id === it.productId);
      if (!product) throw new Error("Product not found");
      if (product.quantity < it.quantity) {
        throw new Error(`Insufficient stock for ${product.name} (have ${product.quantity}, need ${it.quantity})`);
      }
      return {
        productId: product.id,
        productName: product.name,
        masterPricePaise: product.pricePaise, // snapshot — adjusted price below never overwrites this
        adjustedPricePaise: it.adjustedPricePaise,
        quantity: it.quantity,
        subtotalPaise: it.adjustedPricePaise * it.quantity,
      };
    });
    const totalPaise = items.reduce((s, it) => s + it.subtotalPaise, 0);
    const finalAmountPaise = Math.max(0, totalPaise - input.discountPaise);
    const advancePaise = Math.min(input.advancePaise, finalAmountPaise);
    const balancePaise = finalAmountPaise - advancePaise;
    const plan =
      balancePaise > 0
        ? planFromInstallmentAmount(balancePaise, input.financeAmountPaise)
        : { durationCount: 0, regularInstallmentPaise: 0, finalInstallmentPaise: 0 };

    const saleId = genId("sale");
    const customerId = genId("cust");
    const sale: Sale = {
      id: saleId,
      customerId,
      items,
      totalPaise,
      discountPaise: input.discountPaise,
      finalAmountPaise,
      advancePaise,
      balancePaise,
      financePlan: {
        occurrence: input.occurrence,
        financeAmountPaise: input.financeAmountPaise,
        durationCount: plan.durationCount,
        regularInstallmentPaise: plan.regularInstallmentPaise,
        finalInstallmentPaise: plan.finalInstallmentPaise,
      },
      saleDate: input.purchaseDate,
      createdAt: todayIso(),
    };

    const customer: Customer = {
      id: customerId,
      fieldId: field.id,
      fieldCode: field.code,
      serialNo,
      name: input.name,
      relation: input.relation,
      relationName: input.relationName,
      address: input.address,
      phone: input.phone,
      aadhaarLast4: input.aadhaarLast4 ?? null,
      notes: input.notes ?? null,
      status: balancePaise > 0 ? CustomerStatus.Active : CustomerStatus.Inactive,
      saleId,
      approvalStatus: CustomerApprovalStatus.Approved,
      submittedBy: null,
      submittedByName: null,
      createdAt: todayIso(),
    };

    // Decrement inventory — adjusted price is session-only and is never written to the product master.
    for (const item of items) {
      const product = db.products.find((p) => p.id === item.productId)!;
      product.quantity -= item.quantity;
      db.inventoryTxns.push({
        id: genId("itxn"),
        productId: product.id,
        type: InventoryTxnType.SaleOut,
        quantityDelta: -item.quantity,
        balanceAfter: product.quantity,
        referenceId: saleId,
        note: `Sale to ${customer.fieldCode}-${customer.serialNo}`,
        createdAt: todayIso(),
      });
    }

    db.sales.push(sale);
    db.customers.push(customer);
    db.ledgerEntries.push({
      id: genId("ledg"),
      customerId,
      saleId,
      date: input.purchaseDate,
      type: LedgerEntryType.Sale,
      debitPaise: finalAmountPaise,
      creditPaise: 0,
      balanceAfterPaise: balancePaise,
      collectedBy: null,
      note: "Sale — finance plan opened",
      createdAt: todayIso(),
    });

    return { customer, sale };
  });
}

export async function markCustomerInactive(id: string): Promise<Customer> {
  await delay();
  return mutate((db) => {
    const c = db.customers.find((x) => x.id === id);
    if (!c) throw new Error("Customer not found");
    c.status = CustomerStatus.Inactive;
    return c;
  });
}

export async function markCustomerReturn(id: string, note?: string, reason?: string): Promise<Customer> {
  await delay(300);
  return mutate((db) => {
    const c = db.customers.find((x) => x.id === id);
    if (!c) throw new Error("Customer not found");
    const sale = db.sales.find((s) => s.id === c.saleId);
    if (!sale) throw new Error("Sale not found");

    // Restore inventory for every item on the sale.
    for (const item of sale.items) {
      const product = db.products.find((p) => p.id === item.productId);
      if (!product) continue;
      product.quantity += item.quantity;
      db.inventoryTxns.push({
        id: genId("itxn"),
        productId: product.id,
        type: InventoryTxnType.ReturnIn,
        quantityDelta: item.quantity,
        balanceAfter: product.quantity,
        referenceId: sale.id,
        note: `Return from ${c.fieldCode}-${c.serialNo}`,
        createdAt: todayIso(),
      });
    }

    db.returns.push({
      id: genId("ret"),
      customerId: c.id,
      saleId: sale.id,
      advanceRefundedPaise: sale.advancePaise,
      returnedAt: todayIso(),
      reason: reason ?? null,
      note: note ?? null,
    });

    db.ledgerEntries.push({
      id: genId("ledg"),
      customerId: c.id,
      saleId: sale.id,
      date: todayIso(),
      type: LedgerEntryType.Return,
      debitPaise: 0,
      creditPaise: 0,
      balanceAfterPaise: 0,
      collectedBy: null,
      note: `Product returned; advance of ${sale.advancePaise} paise refunded; inventory restored`,
      createdAt: todayIso(),
    });

    sale.balancePaise = 0;
    c.status = CustomerStatus.Inactive;
    return c;
  });
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export interface ListBatchesParams {
  fieldId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

/** Posted (Approved) batches — what the Collections Dashboard shows. */
export async function listCollectionBatches(params: ListBatchesParams = {}): Promise<Page<CollectionBatch>> {
  await delay();
  const { fieldId, dateFrom, dateTo, page = 1, pageSize = 15 } = params;
  let items = getDb().collectionBatches.filter((b) => b.status === CollectionBatchStatus.Approved);
  if (fieldId) items = items.filter((b) => b.fieldId === fieldId);
  if (dateFrom) items = items.filter((b) => b.date >= dateFrom);
  if (dateTo) items = items.filter((b) => b.date <= dateTo);
  items = [...items].sort((a, b) => b.date.localeCompare(a.date));
  const total = items.length;
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total };
}

export async function getBatch(id: string): Promise<CollectionBatch | undefined> {
  await delay();
  return getDb().collectionBatches.find((b) => b.id === id);
}

/** Duplicate-batch guard: look up an existing batch for (date, field) to load instead of creating a new one. */
export async function findBatchForDateField(date: string, fieldId: string): Promise<CollectionBatch | undefined> {
  await delay(150);
  return getDb().collectionBatches.find(
    (b) => b.date === date && b.fieldId === fieldId && b.status !== CollectionBatchStatus.Rejected,
  );
}

export interface BatchEntryInput {
  serialNo: number;
  amountPaise: number;
}

function validateEntry(
  db: ReturnType<typeof getDb>,
  fieldId: string,
  input: BatchEntryInput,
): { customer: Customer | null; error: string | null } {
  if (!input.serialNo || input.amountPaise <= 0) return { customer: null, error: null }; // blank row, ignore silently
  const customer = db.customers.find((c) => c.fieldId === fieldId && c.serialNo === input.serialNo) ?? null;
  if (!customer) return { customer: null, error: "Serial number not found in this field" };
  if (customer.status !== CustomerStatus.Active) return { customer, error: "Customer is inactive" };
  const sale = db.sales.find((s) => s.id === customer.saleId);
  if (!sale) return { customer, error: "Sale not found" };
  if (input.amountPaise > sale.balancePaise) return { customer, error: "Exceeds remaining balance" };
  return { customer, error: null };
}

/**
 * Validate a batch's entries without saving — used for live inline validation
 * as the admin types into the Add Collection grid.
 */
export async function validateBatchEntries(
  fieldId: string,
  entries: BatchEntryInput[],
): Promise<{ serialNo: number; amountPaise: number; error: string | null }[]> {
  await delay(80);
  const db = getDb();
  return entries.map((e) => ({ ...e, error: validateEntry(db, fieldId, e).error }));
}

export interface SaveBatchInput {
  date: string;
  fieldId: string;
  entries: BatchEntryInput[];
}

export interface SaveBatchResult {
  batch: CollectionBatch;
  rejectedEntries: { serialNo: number; error: string }[];
}

/** Posts a batch immediately (owner/admin entering directly from the Collections Dashboard). */
export async function saveCollectionBatch(input: SaveBatchInput): Promise<SaveBatchResult> {
  await delay(350);
  return mutate((db) => {
    const field = db.fields.find((f) => f.id === input.fieldId);
    if (!field) throw new Error("Field not found");

    const collectorName = requireAdminName();
    const rejectedEntries: { serialNo: number; error: string }[] = [];
    const postedEntries: CollectionEntry[] = [];
    let totalAmountPaise = 0;
    let batchIdCounter = 0;

    let batch = db.collectionBatches.find(
      (b) => b.date === input.date && b.fieldId === input.fieldId && b.status !== CollectionBatchStatus.Rejected,
    );
    if (!batch) {
      batch = {
        id: genId("batch"),
        date: input.date,
        fieldId: field.id,
        fieldCode: field.code,
        collectorId: null,
        collectorName,
        entries: [],
        totalAmountPaise: 0,
        status: CollectionBatchStatus.Approved,
        createdAt: todayIso(),
      };
      db.collectionBatches.push(batch);
    }

    for (const raw of input.entries) {
      if (!raw.serialNo || raw.amountPaise <= 0) continue; // blank row
      const { customer, error } = validateEntry(db, input.fieldId, raw);
      if (error || !customer) {
        rejectedEntries.push({ serialNo: raw.serialNo, error: error ?? "Invalid entry" });
        continue;
      }
      const sale = db.sales.find((s) => s.id === customer.saleId)!;
      sale.balancePaise -= raw.amountPaise;
      const entry: CollectionEntry = {
        id: genId("bentry"),
        batchId: batch.id,
        customerId: customer.id,
        serialNo: raw.serialNo,
        amountPaise: raw.amountPaise,
        error: null,
      };
      postedEntries.push(entry);
      totalAmountPaise += raw.amountPaise;

      db.ledgerEntries.push({
        id: genId("ledg"),
        customerId: customer.id,
        saleId: sale.id,
        date: input.date,
        type: LedgerEntryType.Collection,
        debitPaise: 0,
        creditPaise: raw.amountPaise,
        balanceAfterPaise: sale.balancePaise,
        collectedBy: collectorName,
        note: null,
        createdAt: todayIso(),
      });

      if (sale.balancePaise <= 0) {
        customer.status = CustomerStatus.Inactive;
      }
      batchIdCounter += 1;
    }

    batch.entries = [...batch.entries, ...postedEntries];
    batch.totalAmountPaise += totalAmountPaise;
    void batchIdCounter;

    return { batch, rejectedEntries };
  });
}

/** Soft-delete: reverses every posted entry's effect on the ledger/balances, then marks the batch Rejected. */
export async function deleteCollectionBatch(id: string): Promise<void> {
  await delay(300);
  mutate((db) => {
    const batch = db.collectionBatches.find((b) => b.id === id);
    if (!batch) throw new Error("Batch not found");
    if (batch.status === CollectionBatchStatus.Approved) {
      for (const entry of batch.entries) {
        const customer = db.customers.find((c) => c.id === entry.customerId);
        if (!customer) continue;
        const sale = db.sales.find((s) => s.id === customer.saleId);
        if (!sale) continue;
        const wasInactive = customer.status === CustomerStatus.Inactive;
        sale.balancePaise += entry.amountPaise;
        if (wasInactive && sale.balancePaise > 0) customer.status = CustomerStatus.Active;
        db.ledgerEntries.push({
          id: genId("ledg"),
          customerId: customer.id,
          saleId: sale.id,
          date: todayIso(),
          type: LedgerEntryType.Collection,
          debitPaise: entry.amountPaise,
          creditPaise: 0,
          balanceAfterPaise: sale.balancePaise,
          collectedBy: null,
          note: "Collection batch deleted — entry reversed",
          createdAt: todayIso(),
        });
      }
    }
    batch.status = CollectionBatchStatus.Rejected;
  });
}

// ---------------------------------------------------------------------------
// Collection Approval Portal (collector-submitted batches from the mobile app)
// ---------------------------------------------------------------------------

export async function listPendingBatches(): Promise<CollectionBatch[]> {
  await delay();
  return getDb()
    .collectionBatches.filter((b) => b.status === CollectionBatchStatus.Pending || b.status === CollectionBatchStatus.Verified)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function verifyBatch(id: string): Promise<CollectionBatch> {
  await delay(250);
  return mutate((db) => {
    const batch = db.collectionBatches.find((b) => b.id === id);
    if (!batch) throw new Error("Batch not found");
    batch.status = CollectionBatchStatus.Verified;
    return batch;
  });
}

export async function rejectBatch(id: string): Promise<CollectionBatch> {
  await delay(250);
  return mutate((db) => {
    const batch = db.collectionBatches.find((b) => b.id === id);
    if (!batch) throw new Error("Batch not found");
    batch.status = CollectionBatchStatus.Rejected;
    return batch;
  });
}

/** Approves a pending/verified batch: posts every valid entry to the ledger now. */
export async function approveBatch(id: string): Promise<SaveBatchResult> {
  await delay(350);
  return mutate((db) => {
    const batch = db.collectionBatches.find((b) => b.id === id);
    if (!batch) throw new Error("Batch not found");
    const rejectedEntries: { serialNo: number; error: string }[] = [];
    const keptEntries: CollectionEntry[] = [];
    let posted = 0;

    for (const entry of batch.entries) {
      const { customer, error } = validateEntry(db, batch.fieldId, {
        serialNo: entry.serialNo,
        amountPaise: entry.amountPaise,
      });
      if (error || !customer) {
        rejectedEntries.push({ serialNo: entry.serialNo, error: error ?? "Invalid entry" });
        continue;
      }
      const sale = db.sales.find((s) => s.id === customer.saleId)!;
      sale.balancePaise -= entry.amountPaise;
      db.ledgerEntries.push({
        id: genId("ledg"),
        customerId: customer.id,
        saleId: sale.id,
        date: batch.date,
        type: LedgerEntryType.Collection,
        debitPaise: 0,
        creditPaise: entry.amountPaise,
        balanceAfterPaise: sale.balancePaise,
        collectedBy: batch.collectorName,
        note: null,
        createdAt: todayIso(),
      });
      if (sale.balancePaise <= 0) customer.status = CustomerStatus.Inactive;
      keptEntries.push(entry);
      posted += entry.amountPaise;
    }

    batch.entries = keptEntries;
    batch.totalAmountPaise = posted;
    batch.status = CollectionBatchStatus.Approved;
    return { batch, rejectedEntries };
  });
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export interface ReportsSummary {
  mtdCollectedPaise: number;
  totalOutstandingPaise: number;
  activeCustomers: number;
  overdueCustomers: number;
  byField: {
    fieldCode: string;
    activeCustomers: number;
    totalOutstandingPaise: number;
    mtdCollectedPaise: number;
    collectionRatePct: number;
  }[];
  byCollector: {
    collectorName: string;
    fields: string[];
    batchesSubmitted: number;
    totalCollectedPaise: number;
    lastSubmissionDate: string | null;
  }[];
}

function monthStartIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export async function reportsSummary(): Promise<ReportsSummary> {
  await delay(300);
  const db = getDb();
  const mtdStart = monthStartIso();
  const collectionEntriesThisMonth = db.ledgerEntries.filter(
    (e) => e.type === LedgerEntryType.Collection && e.date >= mtdStart,
  );
  const mtdCollectedPaise = collectionEntriesThisMonth.reduce((s, e) => s + e.creditPaise, 0);
  const totalOutstandingPaise = db.sales.reduce((s, sale) => s + sale.balancePaise, 0);
  const activeCustomers = db.customers.filter((c) => c.status === CustomerStatus.Active).length;

  const overdueCustomers = db.customers.filter((c) => {
    if (c.status !== CustomerStatus.Active) return false;
    const lastCollection = db.ledgerEntries
      .filter((e) => e.customerId === c.id && e.type === LedgerEntryType.Collection)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const sale = db.sales.find((s) => s.id === c.saleId);
    if (!sale) return false;
    const stepDays = sale.financePlan.occurrence === "DAILY" ? 1 : sale.financePlan.occurrence === "WEEKLY" ? 7 : 30;
    const referenceDate = lastCollection?.date ?? sale.saleDate;
    const daysSince = Math.floor((Date.now() - new Date(referenceDate).getTime()) / 86_400_000);
    return daysSince > stepDays * 2;
  }).length;

  const byField = db.fields.map((field) => {
    const fieldCustomers = db.customers.filter((c) => c.fieldId === field.id);
    const active = fieldCustomers.filter((c) => c.status === CustomerStatus.Active);
    const outstanding = fieldCustomers.reduce((s, c) => {
      const sale = db.sales.find((x) => x.id === c.saleId);
      return s + (sale?.balancePaise ?? 0);
    }, 0);
    const collected = collectionEntriesThisMonth
      .filter((e) => fieldCustomers.some((c) => c.id === e.customerId))
      .reduce((s, e) => s + e.creditPaise, 0);
    const denom = collected + outstanding;
    return {
      fieldCode: field.code,
      activeCustomers: active.length,
      totalOutstandingPaise: outstanding,
      mtdCollectedPaise: collected,
      collectionRatePct: denom > 0 ? Math.round((collected / denom) * 100) : 0,
    };
  });

  const collectors = db.users.filter((u) => u.role === Role.Collector);
  const byCollector = collectors.map((collector) => {
    const batches = db.collectionBatches.filter((b) => b.collectorId === collector.id && b.status === CollectionBatchStatus.Approved);
    const totalCollectedPaise = batches.reduce((s, b) => s + b.totalAmountPaise, 0);
    const lastSubmissionDate = batches.length ? batches.map((b) => b.date).sort().slice(-1)[0]! : null;
    return {
      collectorName: collector.name,
      fields: collector.fieldIds.map((id) => db.fields.find((f) => f.id === id)?.code ?? "?"),
      batchesSubmitted: batches.length,
      totalCollectedPaise,
      lastSubmissionDate,
    };
  });

  return { mtdCollectedPaise, totalOutstandingPaise, activeCustomers, overdueCustomers, byField, byCollector };
}
