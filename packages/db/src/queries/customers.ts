import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import {
  CustomerApprovalStatus,
  CustomerStatus,
  LedgerEntryType,
  InventoryTxnType,
  planFromInstallmentAmount,
  type Customer,
  type LedgerEntry,
  type Occurrence,
  type Relation,
  type Sale,
  type SaleItem,
} from "@indus/shared-types";
import { db } from "../client.js";
import { customers, fields, inventoryTransactions, ledgerEntries, products, returns, saleItems, sales } from "../schema.js";
import { genId, todayIso } from "../id.js";
import type { Page } from "./types.js";

export interface CustomerListRow extends Customer {
  purchaseDate: string;
  productsSummary: string;
  occurrence: Occurrence;
  financeAmountPaise: number;
  finalAmountPaise: number;
  advancePaise: number;
  balancePaise: number;
  /** Most recent COLLECTION ledger entry date, if any — powers "not collected in N days" filtering. */
  lastCollectionDate: string | null;
}

export interface ListCustomersParams {
  search?: string;
  fieldId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  /** When set, returns this submitter's own customers at any approval status (pending/approved/rejected) instead of the default approved-only list. Used by the vendor app's "my submissions" view. */
  submittedBy?: string;
}

function toCustomer(row: typeof customers.$inferSelect): Customer {
  return {
    id: row.id,
    fieldId: row.fieldId,
    fieldCode: row.fieldCode,
    serialNo: row.serialNo,
    name: row.name,
    relation: row.relation as Relation,
    relationName: row.relationName,
    address: row.address,
    phone: row.phone,
    aadhaarLast4: row.aadhaarLast4,
    notes: row.notes,
    status: row.status as CustomerStatus,
    saleId: row.saleId ?? "",
    approvalStatus: row.approvalStatus as CustomerApprovalStatus,
    submittedBy: row.submittedBy,
    submittedByName: row.submittedByName,
    createdAt: row.createdAt,
  };
}

function toSale(row: typeof sales.$inferSelect, items: SaleItem[]): Sale {
  return {
    id: row.id,
    customerId: row.customerId,
    items,
    totalPaise: row.totalPaise,
    discountPaise: row.discountPaise,
    finalAmountPaise: row.finalAmountPaise,
    advancePaise: row.advancePaise,
    balancePaise: row.balancePaise,
    financePlan: {
      occurrence: row.occurrence as Occurrence,
      financeAmountPaise: row.financeAmountPaise,
      durationCount: row.durationCount,
      regularInstallmentPaise: row.regularInstallmentPaise,
      finalInstallmentPaise: row.finalInstallmentPaise,
    },
    saleDate: row.saleDate,
    createdAt: row.createdAt,
  };
}

function toSaleItem(row: typeof saleItems.$inferSelect): SaleItem {
  return {
    productId: row.productId,
    productName: row.productName,
    masterPricePaise: row.masterPricePaise,
    adjustedPricePaise: row.adjustedPricePaise,
    quantity: row.quantity,
    subtotalPaise: row.subtotalPaise,
  };
}

export async function listCustomers(params: ListCustomersParams = {}): Promise<Page<CustomerListRow>> {
  const { search = "", fieldId, dateFrom, dateTo, page = 1, pageSize = 15, submittedBy } = params;

  const conditions = [];
  if (submittedBy) {
    conditions.push(eq(customers.submittedBy, submittedBy));
  } else {
    conditions.push(eq(customers.approvalStatus, CustomerApprovalStatus.Approved));
  }
  if (fieldId) conditions.push(eq(customers.fieldId, fieldId));
  if (dateFrom) conditions.push(gte(customers.createdAt, dateFrom));
  if (dateTo) conditions.push(lte(customers.createdAt, dateTo));
  if (search.trim()) {
    const q = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(customers.name, q),
        ilike(customers.phone, q),
        ilike(customers.relationName, q),
        sql`(${customers.fieldCode} || '-' || ${customers.serialNo}::text) ILIKE ${q}`,
        sql`${customers.serialNo}::text ILIKE ${q}`,
      ),
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(where)
      .orderBy(desc(customers.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(customers).where(where),
  ]);

  const lastCollectionRows = rows.length
    ? await db
        .select({ customerId: ledgerEntries.customerId, lastDate: sql<string>`max(${ledgerEntries.date})` })
        .from(ledgerEntries)
        .where(
          and(
            inArray(
              ledgerEntries.customerId,
              rows.map((r) => r.id),
            ),
            eq(ledgerEntries.type, LedgerEntryType.Collection),
          ),
        )
        .groupBy(ledgerEntries.customerId)
    : [];
  const lastCollectionByCustomer = new Map(lastCollectionRows.map((r) => [r.customerId, r.lastDate]));

  const items: CustomerListRow[] = await Promise.all(
    rows.map(async (row) => {
      const saleRows = row.saleId ? await db.select().from(sales).where(eq(sales.id, row.saleId)).limit(1) : [];
      const saleRow = saleRows[0];
      const itemRows = saleRow ? await db.select().from(saleItems).where(eq(saleItems.saleId, saleRow.id)) : [];
      const productsSummary = itemRows.map((i) => `${i.productName} x${i.quantity}`).join(", ");
      return {
        ...toCustomer(row),
        purchaseDate: saleRow?.saleDate ?? "",
        productsSummary,
        occurrence: (saleRow?.occurrence as Occurrence) ?? "WEEKLY",
        financeAmountPaise: saleRow?.financeAmountPaise ?? 0,
        finalAmountPaise: saleRow?.finalAmountPaise ?? 0,
        advancePaise: saleRow?.advancePaise ?? 0,
        balancePaise: saleRow?.balancePaise ?? 0,
        lastCollectionDate: lastCollectionByCustomer.get(row.id) ?? null,
      };
    }),
  );

  return { items, total: totalRows[0]?.value ?? 0 };
}

export interface CustomerWithSale {
  customer: Customer;
  sale: Sale;
}

export async function getCustomer(id: string): Promise<CustomerWithSale | undefined> {
  const rows = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  const customerRow = rows[0];
  if (!customerRow || !customerRow.saleId) return undefined;
  const saleRows = await db.select().from(sales).where(eq(sales.id, customerRow.saleId)).limit(1);
  const saleRow = saleRows[0];
  if (!saleRow) return undefined;
  const itemRows = await db.select().from(saleItems).where(eq(saleItems.saleId, saleRow.id));
  return { customer: toCustomer(customerRow), sale: toSale(saleRow, itemRows.map(toSaleItem)) };
}

export async function getCustomerLedger(id: string): Promise<LedgerEntry[]> {
  const rows = await db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.customerId, id))
    .orderBy(asc(ledgerEntries.date), asc(ledgerEntries.createdAt));
  return rows.map((r) => ({
    id: r.id,
    customerId: r.customerId,
    saleId: r.saleId,
    date: r.date,
    type: r.type as LedgerEntry["type"],
    debitPaise: r.debitPaise,
    creditPaise: r.creditPaise,
    balanceAfterPaise: r.balanceAfterPaise,
    collectedBy: r.collectedBy,
    note: r.note,
    createdAt: r.createdAt,
  }));
}

export interface CreateCustomerInput {
  fieldId: string;
  purchaseDate: string;
  name: string;
  relation: Relation;
  relationName: string;
  address: string;
  phone: string;
  aadhaarLast4?: string;
  notes?: string;
  items: { productId: string; adjustedPricePaise: number; quantity: number }[];
  discountPaise: number;
  advancePaise: number;
  occurrence: Occurrence;
  financeAmountPaise: number;
  /** Set when a collector submits a sale from the vendor app — the sale is held PENDING (no ledger/inventory effect) until an admin approves it. */
  submittedBy?: { id: string; name: string };
}

export async function createCustomer(input: CreateCustomerInput): Promise<CustomerWithSale> {
  if (input.items.length === 0) throw new Error("At least one product is required");
  const isPending = !!input.submittedBy;

  return db.transaction(async (tx) => {
    const fieldRows = await tx.select().from(fields).where(eq(fields.id, input.fieldId)).limit(1);
    const field = fieldRows[0];
    if (!field) throw new Error("Field not found");

    const maxSerialRows = await tx
      .select({ maxSerial: sql<number>`coalesce(max(${customers.serialNo}), 0)` })
      .from(customers)
      .where(eq(customers.fieldId, field.id));
    const serialNo = (maxSerialRows[0]?.maxSerial ?? 0) + 1;

    const items: (SaleItem & { productId: string })[] = [];
    for (const it of input.items) {
      const productRows = await tx.select().from(products).where(eq(products.id, it.productId)).limit(1);
      const product = productRows[0];
      if (!product) throw new Error("Product not found");
      if (product.quantity < it.quantity) {
        throw new Error(`Insufficient stock for ${product.name} (have ${product.quantity}, need ${it.quantity})`);
      }
      items.push({
        productId: product.id,
        productName: product.name,
        masterPricePaise: product.pricePaise,
        adjustedPricePaise: it.adjustedPricePaise,
        quantity: it.quantity,
        subtotalPaise: it.adjustedPricePaise * it.quantity,
      });
    }

    const totalPaise = items.reduce((s, it) => s + it.subtotalPaise, 0);
    const finalAmountPaise = Math.max(0, totalPaise - input.discountPaise);
    const advancePaise = Math.min(input.advancePaise, finalAmountPaise);
    const balancePaise = finalAmountPaise - advancePaise;
    const plan =
      balancePaise > 0
        ? planFromInstallmentAmount(balancePaise, input.financeAmountPaise)
        : { durationCount: 0, regularInstallmentPaise: 0, finalInstallmentPaise: 0 };

    const customerId = genId("cust");
    const saleId = genId("sale");
    const createdAt = todayIso();
    const status = balancePaise > 0 ? CustomerStatus.Active : CustomerStatus.Inactive;

    await tx.insert(customers).values({
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
      status,
      saleId: null,
      approvalStatus: isPending ? CustomerApprovalStatus.Pending : CustomerApprovalStatus.Approved,
      submittedBy: input.submittedBy?.id ?? null,
      submittedByName: input.submittedBy?.name ?? null,
      createdAt,
    });

    await tx.insert(sales).values({
      id: saleId,
      customerId,
      totalPaise,
      discountPaise: input.discountPaise,
      finalAmountPaise,
      advancePaise,
      balancePaise,
      occurrence: input.occurrence,
      financeAmountPaise: input.financeAmountPaise,
      durationCount: plan.durationCount,
      regularInstallmentPaise: plan.regularInstallmentPaise,
      finalInstallmentPaise: plan.finalInstallmentPaise,
      saleDate: input.purchaseDate,
      createdAt,
    });

    await tx.update(customers).set({ saleId }).where(eq(customers.id, customerId));

    for (const item of items) {
      await tx.insert(saleItems).values({
        id: genId("sitem"),
        saleId,
        productId: item.productId,
        productName: item.productName,
        masterPricePaise: item.masterPricePaise,
        adjustedPricePaise: item.adjustedPricePaise,
        quantity: item.quantity,
        subtotalPaise: item.subtotalPaise,
      });

      if (!isPending) {
        const productRows = await tx.select().from(products).where(eq(products.id, item.productId)).limit(1);
        const product = productRows[0]!;
        const newQuantity = product.quantity - item.quantity;
        await tx.update(products).set({ quantity: newQuantity }).where(eq(products.id, item.productId));
        await tx.insert(inventoryTransactions).values({
          id: genId("itxn"),
          productId: item.productId,
          type: InventoryTxnType.SaleOut,
          quantityDelta: -item.quantity,
          balanceAfter: newQuantity,
          referenceId: saleId,
          note: `Sale to ${field.code}-${serialNo}`,
          createdAt,
        });
      }
    }

    if (!isPending) {
      await tx.insert(ledgerEntries).values({
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
        createdAt,
      });
    }

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
      status,
      saleId,
      approvalStatus: isPending ? CustomerApprovalStatus.Pending : CustomerApprovalStatus.Approved,
      submittedBy: input.submittedBy?.id ?? null,
      submittedByName: input.submittedBy?.name ?? null,
      createdAt,
    };
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
      createdAt,
    };
    return { customer, sale };
  });
}

export interface AddSaleItemInput {
  productId: string;
  adjustedPricePaise: number;
  quantity: number;
  addedByName?: string;
}

/**
 * Adds a product to a customer's existing sale (e.g. an add-on purchase from Customer Detail),
 * rather than opening a second sale — the schema is one sale per customer. Grows
 * totalPaise/finalAmountPaise/balancePaise by the new item's subtotal and re-derives the
 * installment plan from the new balance at the sale's existing installment amount (see
 * planFromInstallmentAmount) — same math as opening the original sale, just against a bigger
 * balance. saleDate is left untouched, so scheduleMath's derived-schedule read (see
 * queries/scheduleMath.ts) naturally treats any already-elapsed periods as owed against the new
 * total, consistent with there being no stored per-installment schedule to rewrite.
 */
export async function addSaleItem(customerId: string, input: AddSaleItemInput): Promise<CustomerWithSale> {
  return db.transaction(async (tx) => {
    const customerRows = await tx.select().from(customers).where(eq(customers.id, customerId)).limit(1);
    const customerRow = customerRows[0];
    if (!customerRow || !customerRow.saleId) throw new Error("Customer not found");
    if (customerRow.approvalStatus !== CustomerApprovalStatus.Approved) {
      throw new Error("Only an approved customer's sale can be added to");
    }

    const saleRows = await tx.select().from(sales).where(eq(sales.id, customerRow.saleId)).limit(1);
    const saleRow = saleRows[0];
    if (!saleRow) throw new Error("Sale not found");

    const productRows = await tx.select().from(products).where(eq(products.id, input.productId)).limit(1);
    const product = productRows[0];
    if (!product) throw new Error("Product not found");
    if (product.quantity < input.quantity) {
      throw new Error(`Insufficient stock for ${product.name} (have ${product.quantity}, need ${input.quantity})`);
    }

    const subtotalPaise = input.adjustedPricePaise * input.quantity;
    const createdAt = todayIso();

    await tx.insert(saleItems).values({
      id: genId("sitem"),
      saleId: saleRow.id,
      productId: product.id,
      productName: product.name,
      masterPricePaise: product.pricePaise,
      adjustedPricePaise: input.adjustedPricePaise,
      quantity: input.quantity,
      subtotalPaise,
    });

    const newQuantity = product.quantity - input.quantity;
    await tx.update(products).set({ quantity: newQuantity }).where(eq(products.id, product.id));
    await tx.insert(inventoryTransactions).values({
      id: genId("itxn"),
      productId: product.id,
      type: InventoryTxnType.SaleOut,
      quantityDelta: -input.quantity,
      balanceAfter: newQuantity,
      referenceId: saleRow.id,
      note: `Add-on sale to ${customerRow.fieldCode}-${customerRow.serialNo}`,
      createdAt,
    });

    const totalPaise = saleRow.totalPaise + subtotalPaise;
    const finalAmountPaise = saleRow.finalAmountPaise + subtotalPaise;
    const balancePaise = saleRow.balancePaise + subtotalPaise;
    const plan =
      balancePaise > 0 && saleRow.financeAmountPaise > 0
        ? planFromInstallmentAmount(balancePaise, saleRow.financeAmountPaise)
        : { durationCount: 0, regularInstallmentPaise: 0, finalInstallmentPaise: 0 };

    await tx
      .update(sales)
      .set({
        totalPaise,
        finalAmountPaise,
        balancePaise,
        durationCount: plan.durationCount,
        regularInstallmentPaise: plan.regularInstallmentPaise,
        finalInstallmentPaise: plan.finalInstallmentPaise,
      })
      .where(eq(sales.id, saleRow.id));

    await tx.insert(ledgerEntries).values({
      id: genId("ledg"),
      customerId: customerRow.id,
      saleId: saleRow.id,
      date: createdAt,
      type: LedgerEntryType.Sale,
      debitPaise: subtotalPaise,
      creditPaise: 0,
      balanceAfterPaise: balancePaise,
      collectedBy: input.addedByName ?? null,
      note: `Add-on purchase — ${product.name} x${input.quantity}`,
      createdAt,
    });

    // A previously paid-off (Inactive) customer buying something new is back on the books.
    if (customerRow.status === CustomerStatus.Inactive && balancePaise > 0) {
      await tx.update(customers).set({ status: CustomerStatus.Active }).where(eq(customers.id, customerRow.id));
    }

    const finalCustomerRows = await tx.select().from(customers).where(eq(customers.id, customerId)).limit(1);
    const finalSaleRows = await tx.select().from(sales).where(eq(sales.id, saleRow.id)).limit(1);
    const finalItemRows = await tx.select().from(saleItems).where(eq(saleItems.saleId, saleRow.id));
    return {
      customer: toCustomer(finalCustomerRows[0]!),
      sale: toSale(finalSaleRows[0]!, finalItemRows.map(toSaleItem)),
    };
  });
}

export async function markCustomerInactive(id: string): Promise<Customer> {
  const rows = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!rows[0]) throw new Error("Customer not found");
  await db.update(customers).set({ status: CustomerStatus.Inactive }).where(eq(customers.id, id));
  return { ...toCustomer(rows[0]), status: CustomerStatus.Inactive };
}

export async function markCustomerReturn(id: string, note?: string, reason?: string): Promise<Customer> {
  return db.transaction(async (tx) => {
    const customerRows = await tx.select().from(customers).where(eq(customers.id, id)).limit(1);
    const customerRow = customerRows[0];
    if (!customerRow || !customerRow.saleId) throw new Error("Customer not found");

    const saleRows = await tx.select().from(sales).where(eq(sales.id, customerRow.saleId)).limit(1);
    const saleRow = saleRows[0];
    if (!saleRow) throw new Error("Sale not found");

    const itemRows = await tx.select().from(saleItems).where(eq(saleItems.saleId, saleRow.id));
    const createdAt = todayIso();

    for (const item of itemRows) {
      const productRows = await tx.select().from(products).where(eq(products.id, item.productId)).limit(1);
      const product = productRows[0];
      if (!product) continue;
      const newQuantity = product.quantity + item.quantity;
      await tx.update(products).set({ quantity: newQuantity }).where(eq(products.id, item.productId));
      await tx.insert(inventoryTransactions).values({
        id: genId("itxn"),
        productId: item.productId,
        type: InventoryTxnType.ReturnIn,
        quantityDelta: item.quantity,
        balanceAfter: newQuantity,
        referenceId: saleRow.id,
        note: `Return from ${customerRow.fieldCode}-${customerRow.serialNo}`,
        createdAt,
      });
    }

    await tx.insert(returns).values({
      id: genId("ret"),
      customerId: customerRow.id,
      saleId: saleRow.id,
      advanceRefundedPaise: saleRow.advancePaise,
      returnedAt: createdAt,
      reason: reason ?? null,
      note: note ?? null,
    });

    await tx.insert(ledgerEntries).values({
      id: genId("ledg"),
      customerId: customerRow.id,
      saleId: saleRow.id,
      date: createdAt,
      type: LedgerEntryType.Return,
      debitPaise: 0,
      creditPaise: 0,
      balanceAfterPaise: 0,
      collectedBy: null,
      note: `Product returned; advance of ${saleRow.advancePaise} paise refunded; inventory restored`,
      createdAt,
    });

    await tx.update(sales).set({ balancePaise: 0 }).where(eq(sales.id, saleRow.id));
    await tx.update(customers).set({ status: CustomerStatus.Inactive }).where(eq(customers.id, customerRow.id));

    return { ...toCustomer(customerRow), status: CustomerStatus.Inactive };
  });
}

/** Sales submitted from the vendor app, awaiting admin approval — none of their ledger/inventory effects have been applied yet. */
export async function listPendingCustomers(): Promise<CustomerWithSale[]> {
  const rows = await db
    .select()
    .from(customers)
    .where(eq(customers.approvalStatus, CustomerApprovalStatus.Pending))
    .orderBy(desc(customers.createdAt));

  const out: CustomerWithSale[] = [];
  for (const row of rows) {
    if (!row.saleId) continue;
    const saleRows = await db.select().from(sales).where(eq(sales.id, row.saleId)).limit(1);
    const saleRow = saleRows[0];
    if (!saleRow) continue;
    const itemRows = await db.select().from(saleItems).where(eq(saleItems.saleId, saleRow.id));
    out.push({ customer: toCustomer(row), sale: toSale(saleRow, itemRows.map(toSaleItem)) });
  }
  return out;
}

/** Approves a pending vendor-app sale: applies the deferred inventory stock-out and opens the ledger now. */
export async function approveCustomerSale(id: string): Promise<CustomerWithSale> {
  return db.transaction(async (tx) => {
    const customerRows = await tx.select().from(customers).where(eq(customers.id, id)).limit(1);
    const customerRow = customerRows[0];
    if (!customerRow || !customerRow.saleId) throw new Error("Customer not found");
    if (customerRow.approvalStatus !== CustomerApprovalStatus.Pending) {
      throw new Error("Only a pending sale can be approved");
    }

    const saleRows = await tx.select().from(sales).where(eq(sales.id, customerRow.saleId)).limit(1);
    const saleRow = saleRows[0];
    if (!saleRow) throw new Error("Sale not found");
    const itemRows = await tx.select().from(saleItems).where(eq(saleItems.saleId, saleRow.id));
    const createdAt = todayIso();

    for (const item of itemRows) {
      const productRows = await tx.select().from(products).where(eq(products.id, item.productId)).limit(1);
      const product = productRows[0];
      if (!product) continue;
      if (product.quantity < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name} (have ${product.quantity}, need ${item.quantity})`);
      }
      const newQuantity = product.quantity - item.quantity;
      await tx.update(products).set({ quantity: newQuantity }).where(eq(products.id, item.productId));
      await tx.insert(inventoryTransactions).values({
        id: genId("itxn"),
        productId: item.productId,
        type: InventoryTxnType.SaleOut,
        quantityDelta: -item.quantity,
        balanceAfter: newQuantity,
        referenceId: saleRow.id,
        note: `Sale to ${customerRow.fieldCode}-${customerRow.serialNo} (approved)`,
        createdAt,
      });
    }

    await tx.insert(ledgerEntries).values({
      id: genId("ledg"),
      customerId: customerRow.id,
      saleId: saleRow.id,
      date: saleRow.saleDate,
      type: LedgerEntryType.Sale,
      debitPaise: saleRow.finalAmountPaise,
      creditPaise: 0,
      balanceAfterPaise: saleRow.balancePaise,
      collectedBy: null,
      note: "Sale — finance plan opened (approved)",
      createdAt,
    });

    await tx
      .update(customers)
      .set({ approvalStatus: CustomerApprovalStatus.Approved })
      .where(eq(customers.id, id));

    return { customer: { ...toCustomer(customerRow), approvalStatus: CustomerApprovalStatus.Approved }, sale: toSale(saleRow, itemRows.map(toSaleItem)) };
  });
}

/** Rejects a pending vendor-app sale. No ledger/inventory effects were ever applied, so nothing needs reversing. */
export async function rejectCustomerSale(id: string): Promise<Customer> {
  const rows = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new Error("Customer not found");
  if (row.approvalStatus !== CustomerApprovalStatus.Pending) {
    throw new Error("Only a pending sale can be rejected");
  }
  await db.update(customers).set({ approvalStatus: CustomerApprovalStatus.Rejected }).where(eq(customers.id, id));
  return { ...toCustomer(row), approvalStatus: CustomerApprovalStatus.Rejected };
}
