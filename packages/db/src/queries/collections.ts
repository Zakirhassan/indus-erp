import { and, count, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, ne, or } from "drizzle-orm";
import {
  CollectionBatchStatus,
  CustomerStatus,
  LedgerEntryType,
  type CollectionBatch,
  type CollectionEntry,
} from "@indus/shared-types";
import { db } from "../client.js";
import { collectionBatches, collectionEntries, customers, fields, ledgerEntries, sales } from "../schema.js";
import { genId, todayIso } from "../id.js";
import type { Page } from "./types.js";

function toEntry(row: typeof collectionEntries.$inferSelect): CollectionEntry {
  return {
    id: row.id,
    batchId: row.batchId,
    customerId: row.customerId,
    serialNo: row.serialNo,
    amountPaise: row.amountPaise,
    error: row.error,
  };
}

function toBatch(row: typeof collectionBatches.$inferSelect, entries: CollectionEntry[]): CollectionBatch {
  return {
    id: row.id,
    date: row.date,
    fieldId: row.fieldId,
    fieldCode: row.fieldCode,
    collectorId: row.collectorId,
    collectorName: row.collectorName,
    entries,
    totalAmountPaise: row.totalAmountPaise,
    status: row.status as CollectionBatchStatus,
    createdAt: row.createdAt,
    reopenedAt: row.reopenedAt,
    reopenedByName: row.reopenedByName,
  };
}

async function withEntries(row: typeof collectionBatches.$inferSelect): Promise<CollectionBatch> {
  const entryRows = await db.select().from(collectionEntries).where(eq(collectionEntries.batchId, row.id));
  return toBatch(row, entryRows.map(toEntry));
}

export interface ListBatchesParams {
  fieldId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

/** Posted (Approved) batches — what the Collections Dashboard shows. */
export async function listCollectionBatches(params: ListBatchesParams = {}): Promise<Page<CollectionBatch>> {
  const { fieldId, dateFrom, dateTo, page = 1, pageSize = 15 } = params;
  const conditions = [eq(collectionBatches.status, CollectionBatchStatus.Approved)];
  if (fieldId) conditions.push(eq(collectionBatches.fieldId, fieldId));
  if (dateFrom) conditions.push(gte(collectionBatches.date, dateFrom));
  if (dateTo) conditions.push(lte(collectionBatches.date, dateTo));
  const where = and(...conditions);

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(collectionBatches)
      .where(where)
      .orderBy(desc(collectionBatches.date))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(collectionBatches).where(where),
  ]);

  const items = await Promise.all(rows.map(withEntries));
  return { items, total: totalRows[0]?.value ?? 0 };
}

export async function getBatch(id: string): Promise<CollectionBatch | undefined> {
  const rows = await db.select().from(collectionBatches).where(eq(collectionBatches.id, id)).limit(1);
  const row = rows[0];
  return row ? withEntries(row) : undefined;
}

/** Duplicate-batch guard: look up an existing batch for (date, field) to load instead of creating a new one. */
export async function findBatchForDateField(date: string, fieldId: string): Promise<CollectionBatch | undefined> {
  const rows = await db
    .select()
    .from(collectionBatches)
    .where(
      and(
        eq(collectionBatches.date, date),
        eq(collectionBatches.fieldId, fieldId),
        ne(collectionBatches.status, CollectionBatchStatus.Rejected),
      ),
    )
    .limit(1);
  const row = rows[0];
  return row ? withEntries(row) : undefined;
}

/** Same guard as findBatchForDateField, scoped to one collector — used by the vendor app to resume today's in-progress submission. */
export async function findBatchForDateFieldCollector(
  date: string,
  fieldId: string,
  collectorId: string,
): Promise<CollectionBatch | undefined> {
  const rows = await db
    .select()
    .from(collectionBatches)
    .where(
      and(
        eq(collectionBatches.date, date),
        eq(collectionBatches.fieldId, fieldId),
        eq(collectionBatches.collectorId, collectorId),
        ne(collectionBatches.status, CollectionBatchStatus.Rejected),
      ),
    )
    .limit(1);
  const row = rows[0];
  return row ? withEntries(row) : undefined;
}

export interface BatchEntryInput {
  serialNo: number;
  amountPaise: number;
}

/** Pure business rule — given the looked-up customer/sale, decide whether an entry is postable. */
function evaluateEntry(
  customer: typeof customers.$inferSelect | undefined,
  sale: typeof sales.$inferSelect | undefined,
  amountPaise: number,
): string | null {
  if (!customer) return "Serial number not found in this field";
  if (customer.status !== CustomerStatus.Active) return "Customer is inactive";
  if (!sale) return "Sale not found";
  if (amountPaise > sale.balancePaise) return "Exceeds remaining balance";
  return null;
}

async function lookupCustomerAndSale(fieldId: string, serialNo: number) {
  const customerRows = await db
    .select()
    .from(customers)
    .where(and(eq(customers.fieldId, fieldId), eq(customers.serialNo, serialNo)))
    .limit(1);
  const customer = customerRows[0];
  if (!customer?.saleId) return { customer, sale: undefined };
  const saleRows = await db.select().from(sales).where(eq(sales.id, customer.saleId)).limit(1);
  return { customer, sale: saleRows[0] };
}

/**
 * Validate a batch's entries without saving — used for live inline validation
 * as the admin types into the Add Collection grid.
 */
export async function validateBatchEntries(
  fieldId: string,
  entries: BatchEntryInput[],
): Promise<{ serialNo: number; amountPaise: number; error: string | null }[]> {
  const results: { serialNo: number; amountPaise: number; error: string | null }[] = [];
  for (const e of entries) {
    if (!e.serialNo || e.amountPaise <= 0) {
      results.push({ ...e, error: null }); // blank row, ignore silently
      continue;
    }
    const { customer, sale } = await lookupCustomerAndSale(fieldId, e.serialNo);
    results.push({ ...e, error: evaluateEntry(customer, sale, e.amountPaise) });
  }
  return results;
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
export async function saveCollectionBatch(input: SaveBatchInput, collectorName: string): Promise<SaveBatchResult> {
  return db.transaction(async (tx) => {
    const fieldRows = await tx.select().from(fields).where(eq(fields.id, input.fieldId)).limit(1);
    const field = fieldRows[0];
    if (!field) throw new Error("Field not found");

    const existingRows = await tx
      .select()
      .from(collectionBatches)
      .where(
        and(
          eq(collectionBatches.date, input.date),
          eq(collectionBatches.fieldId, input.fieldId),
          ne(collectionBatches.status, CollectionBatchStatus.Rejected),
        ),
      )
      .limit(1);
    const createdAt = todayIso();
    let batchId = existingRows[0]?.id;
    const existingTotal = existingRows[0]?.totalAmountPaise ?? 0;
    if (!batchId) {
      batchId = genId("batch");
      await tx.insert(collectionBatches).values({
        id: batchId,
        date: input.date,
        fieldId: field.id,
        fieldCode: field.code,
        collectorId: null,
        collectorName,
        totalAmountPaise: 0,
        status: CollectionBatchStatus.Approved,
        createdAt,
      });
    }

    const existingEntryRows = await tx
      .select({ serialNo: collectionEntries.serialNo })
      .from(collectionEntries)
      .where(eq(collectionEntries.batchId, batchId));
    const seenSerials = new Set<number>(existingEntryRows.map((r) => r.serialNo));

    const rejectedEntries: { serialNo: number; error: string }[] = [];
    let addedTotal = 0;

    for (const raw of input.entries) {
      if (!raw.serialNo || raw.amountPaise <= 0) continue; // blank row
      if (seenSerials.has(raw.serialNo)) {
        rejectedEntries.push({ serialNo: raw.serialNo, error: "Already collected in this batch" });
        continue;
      }
      const customerRows = await tx
        .select()
        .from(customers)
        .where(and(eq(customers.fieldId, input.fieldId), eq(customers.serialNo, raw.serialNo)))
        .limit(1);
      const customer = customerRows[0];
      const saleRows = customer?.saleId ? await tx.select().from(sales).where(eq(sales.id, customer.saleId)).limit(1) : [];
      const sale = saleRows[0];
      const error = evaluateEntry(customer, sale, raw.amountPaise);
      if (error || !customer || !sale) {
        rejectedEntries.push({ serialNo: raw.serialNo, error: error ?? "Invalid entry" });
        continue;
      }

      const newBalance = sale.balancePaise - raw.amountPaise;
      await tx.update(sales).set({ balancePaise: newBalance }).where(eq(sales.id, sale.id));
      await tx.insert(collectionEntries).values({
        id: genId("bentry"),
        batchId,
        customerId: customer.id,
        serialNo: raw.serialNo,
        amountPaise: raw.amountPaise,
        error: null,
      });
      await tx.insert(ledgerEntries).values({
        id: genId("ledg"),
        customerId: customer.id,
        saleId: sale.id,
        date: input.date,
        type: LedgerEntryType.Collection,
        debitPaise: 0,
        creditPaise: raw.amountPaise,
        balanceAfterPaise: newBalance,
        collectedBy: collectorName,
        note: null,
        createdAt,
      });
      if (newBalance <= 0) {
        await tx.update(customers).set({ status: CustomerStatus.Inactive }).where(eq(customers.id, customer.id));
      }
      seenSerials.add(raw.serialNo);
      addedTotal += raw.amountPaise;
    }

    const totalAmountPaise = existingTotal + addedTotal;
    await tx.update(collectionBatches).set({ totalAmountPaise }).where(eq(collectionBatches.id, batchId));

    const batchRows = await tx.select().from(collectionBatches).where(eq(collectionBatches.id, batchId)).limit(1);
    const entryRows = await tx.select().from(collectionEntries).where(eq(collectionEntries.batchId, batchId));
    const batch = toBatch(batchRows[0]!, entryRows.map(toEntry));
    return { batch, rejectedEntries };
  });
}

/** Pending/Verified batches submitted from the vendor app, awaiting admin review. Excludes DRAFT — those haven't been submitted yet. */
export async function listPendingCollectionBatches(): Promise<CollectionBatch[]> {
  const rows = await db
    .select()
    .from(collectionBatches)
    .where(
      and(
        ne(collectionBatches.status, CollectionBatchStatus.Draft),
        ne(collectionBatches.status, CollectionBatchStatus.Approved),
        ne(collectionBatches.status, CollectionBatchStatus.Rejected),
      ),
    )
    .orderBy(desc(collectionBatches.date));
  return Promise.all(rows.map(withEntries));
}

/**
 * A collector saves entries from the vendor app as they go through their route.
 * The batch sits DRAFT (scoped to this collector, separate from any admin
 * direct-entry batch for the same date+field) — invisible to admin review and
 * with no ledger/balance effect — until the collector submits it, either one
 * field at a time (submitFieldBatchForDay) or for every field touched that
 * day at once (submitDraftBatchesForDay). Once submitted, the batch is locked:
 * further saves against the same date+field are rejected rather than silently
 * appended, since the admin may already be reviewing it.
 */
export async function submitCollectorBatch(
  input: SaveBatchInput,
  collectorId: string,
  collectorName: string,
): Promise<SaveBatchResult> {
  return db.transaction(async (tx) => {
    const fieldRows = await tx.select().from(fields).where(eq(fields.id, input.fieldId)).limit(1);
    const field = fieldRows[0];
    if (!field) throw new Error("Field not found");

    const existingRows = await tx
      .select()
      .from(collectionBatches)
      .where(
        and(
          eq(collectionBatches.date, input.date),
          eq(collectionBatches.fieldId, input.fieldId),
          eq(collectionBatches.collectorId, collectorId),
          ne(collectionBatches.status, CollectionBatchStatus.Rejected),
        ),
      )
      .limit(1);
    if (existingRows[0] && existingRows[0].status !== CollectionBatchStatus.Draft) {
      throw new Error("This batch has already been submitted for approval");
    }
    const createdAt = todayIso();
    let batchId = existingRows[0]?.id;
    const existingTotal = existingRows[0]?.totalAmountPaise ?? 0;
    // Only a reopened batch allows editing an already-saved entry's amount in place — for a
    // normal first-time draft, a repeat serialNo is a genuine duplicate-entry mistake and stays rejected.
    const allowEntryEdits = !!existingRows[0]?.reopenedAt;
    if (!batchId) {
      batchId = genId("batch");
      await tx.insert(collectionBatches).values({
        id: batchId,
        date: input.date,
        fieldId: field.id,
        fieldCode: field.code,
        collectorId,
        collectorName,
        totalAmountPaise: 0,
        status: CollectionBatchStatus.Draft,
        createdAt,
      });
    }

    const existingEntryRows = await tx
      .select({ id: collectionEntries.id, serialNo: collectionEntries.serialNo, amountPaise: collectionEntries.amountPaise })
      .from(collectionEntries)
      .where(eq(collectionEntries.batchId, batchId));
    const existingBySerial = new Map(existingEntryRows.map((r) => [r.serialNo, r]));

    const rejectedEntries: { serialNo: number; error: string }[] = [];
    let totalDelta = 0;

    for (const raw of input.entries) {
      if (!raw.serialNo || raw.amountPaise <= 0) continue; // blank row
      const existingEntry = existingBySerial.get(raw.serialNo);
      if (existingEntry && !allowEntryEdits) {
        rejectedEntries.push({ serialNo: raw.serialNo, error: "Already collected in this batch" });
        continue;
      }
      const { customer, sale } = await lookupCustomerAndSale(input.fieldId, raw.serialNo);
      const error = evaluateEntry(customer, sale, raw.amountPaise);
      if (error || !customer) {
        rejectedEntries.push({ serialNo: raw.serialNo, error: error ?? "Invalid entry" });
        continue;
      }

      // Not posted yet — no ledger entry, no balance change, no auto-inactive. Deferred to approveCollectionBatch.
      if (existingEntry) {
        if (existingEntry.amountPaise === raw.amountPaise) continue; // unchanged, nothing to do
        await tx.update(collectionEntries).set({ amountPaise: raw.amountPaise, error: null }).where(eq(collectionEntries.id, existingEntry.id));
        totalDelta += raw.amountPaise - existingEntry.amountPaise;
      } else {
        await tx.insert(collectionEntries).values({
          id: genId("bentry"),
          batchId,
          customerId: customer.id,
          serialNo: raw.serialNo,
          amountPaise: raw.amountPaise,
          error: null,
        });
        totalDelta += raw.amountPaise;
      }
    }

    const totalAmountPaise = existingTotal + totalDelta;
    await tx.update(collectionBatches).set({ totalAmountPaise }).where(eq(collectionBatches.id, batchId));

    const batchRows = await tx.select().from(collectionBatches).where(eq(collectionBatches.id, batchId)).limit(1);
    const entryRows = await tx.select().from(collectionEntries).where(eq(collectionEntries.batchId, batchId));
    const batch = toBatch(batchRows[0]!, entryRows.map(toEntry));
    return { batch, rejectedEntries };
  });
}

/** This collector's batches (any field, any status) for one day — powers the vendor app's end-of-day summary. */
export async function listBatchesForCollectorDay(collectorId: string, date: string): Promise<CollectionBatch[]> {
  const rows = await db
    .select()
    .from(collectionBatches)
    .where(and(eq(collectionBatches.collectorId, collectorId), eq(collectionBatches.date, date)))
    .orderBy(desc(collectionBatches.createdAt));
  return Promise.all(rows.map(withEntries));
}

/**
 * DRAFT -> PENDING for every one of this collector's draft batches on a given day (one per
 * field touched), in a single end-of-day action. Batches with no entries are left as-is rather
 * than submitted empty.
 */
export async function submitDraftBatchesForDay(collectorId: string, date: string): Promise<CollectionBatch[]> {
  const draftRows = await db
    .select()
    .from(collectionBatches)
    .where(
      and(
        eq(collectionBatches.collectorId, collectorId),
        eq(collectionBatches.date, date),
        eq(collectionBatches.status, CollectionBatchStatus.Draft),
      ),
    );
  const submittable = draftRows.filter((r) => r.totalAmountPaise > 0);
  if (submittable.length > 0) {
    await db
      .update(collectionBatches)
      .set({ status: CollectionBatchStatus.Pending })
      .where(
        inArray(
          collectionBatches.id,
          submittable.map((r) => r.id),
        ),
      );
  }
  return listBatchesForCollectorDay(collectorId, date);
}

/**
 * DRAFT -> PENDING for one collector's one field on a given day — lets a collector wrap up a
 * route the moment they're done with it, without waiting on other fields. No-op (returns the
 * batch unchanged) if there's nothing to submit or it's already past DRAFT.
 */
export async function submitFieldBatchForDay(
  collectorId: string,
  fieldId: string,
  date: string,
): Promise<CollectionBatch | null> {
  const rows = await db
    .select()
    .from(collectionBatches)
    .where(
      and(
        eq(collectionBatches.collectorId, collectorId),
        eq(collectionBatches.fieldId, fieldId),
        eq(collectionBatches.date, date),
        ne(collectionBatches.status, CollectionBatchStatus.Rejected),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.status === CollectionBatchStatus.Draft && row.totalAmountPaise > 0) {
    await db.update(collectionBatches).set({ status: CollectionBatchStatus.Pending }).where(eq(collectionBatches.id, row.id));
    return withEntries({ ...row, status: CollectionBatchStatus.Pending });
  }
  return withEntries(row);
}

/**
 * Every DRAFT batch this collector recorded (entries > 0) on a day before `today` and never
 * submitted. Backs the vendor app's day-close gate: a collector shouldn't be able to start a
 * new day's collection/sales work while yesterday's route is still sitting un-submitted.
 * Empty drafts (nothing entered) don't count — there's nothing to submit.
 */
export async function listUnsubmittedPriorDayBatches(collectorId: string, today: string): Promise<CollectionBatch[]> {
  const rows = await db
    .select()
    .from(collectionBatches)
    .where(
      and(
        eq(collectionBatches.collectorId, collectorId),
        eq(collectionBatches.status, CollectionBatchStatus.Draft),
        lt(collectionBatches.date, today),
        gt(collectionBatches.totalAmountPaise, 0),
        // A reopened batch is deliberately excluded here: it's DRAFT again so the collector
        // can fix it, not because they forgot to submit it. Trapping them behind the day-close
        // gate for a correction an admin asked for would leave no way to actually fix it.
        isNull(collectionBatches.reopenedAt),
      ),
    )
    .orderBy(collectionBatches.date);
  return Promise.all(rows.map(withEntries));
}

/**
 * DRAFT -> PENDING for every one of this collector's outstanding prior-day batches at once —
 * the "Submit All & Continue" action on the day-close gate. Mirrors submitDraftBatchesForDay
 * but scoped to dates before today instead of a single day.
 */
export async function submitAllPriorDayBatches(collectorId: string, today: string): Promise<CollectionBatch[]> {
  const outstanding = await listUnsubmittedPriorDayBatches(collectorId, today);
  if (outstanding.length > 0) {
    await db
      .update(collectionBatches)
      .set({ status: CollectionBatchStatus.Pending })
      .where(
        inArray(
          collectionBatches.id,
          outstanding.map((b) => b.id),
        ),
      );
  }
  return listUnsubmittedPriorDayBatches(collectorId, today);
}

/**
 * This collector's most recent submitted batches, across every field, plus any batch currently
 * reopened for correction (status is back to DRAFT, but reopenedAt is set) — otherwise a batch
 * reopened from a prior day would be invisible to the collector, with no way to find and fix it.
 * An ordinary still-being-entered DRAFT (reopenedAt null) stays excluded — that's today's
 * in-progress work, not history.
 */
export async function listRecentCollectorBatches(collectorId: string, limit = 20): Promise<CollectionBatch[]> {
  const rows = await db
    .select()
    .from(collectionBatches)
    .where(
      and(
        eq(collectionBatches.collectorId, collectorId),
        or(ne(collectionBatches.status, CollectionBatchStatus.Draft), isNotNull(collectionBatches.reopenedAt)),
      ),
    )
    .orderBy(desc(collectionBatches.date), desc(collectionBatches.createdAt))
    .limit(limit);
  return Promise.all(rows.map(withEntries));
}

/** Pending -> Verified: an admin checkpoint before posting. No ledger/balance effect yet. */
export async function verifyCollectionBatch(id: string): Promise<CollectionBatch> {
  const rows = await db.select().from(collectionBatches).where(eq(collectionBatches.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new Error("Batch not found");
  if (row.status !== CollectionBatchStatus.Pending) throw new Error("Only a pending batch can be verified");
  await db.update(collectionBatches).set({ status: CollectionBatchStatus.Verified }).where(eq(collectionBatches.id, id));
  return withEntries({ ...row, status: CollectionBatchStatus.Verified });
}

/** Pending/Verified -> Rejected. Nothing was ever posted, so there's nothing to reverse. */
export async function rejectCollectionBatch(id: string): Promise<CollectionBatch> {
  const rows = await db.select().from(collectionBatches).where(eq(collectionBatches.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new Error("Batch not found");
  if (row.status === CollectionBatchStatus.Approved || row.status === CollectionBatchStatus.Rejected) {
    throw new Error("Only a pending or verified batch can be rejected this way");
  }
  await db.update(collectionBatches).set({ status: CollectionBatchStatus.Rejected }).where(eq(collectionBatches.id, id));
  return withEntries({ ...row, status: CollectionBatchStatus.Rejected });
}

/** Pending/Verified -> Approved: posts every valid entry to the ledger now (re-validated against current balances). */
export async function approveCollectionBatch(id: string): Promise<SaveBatchResult> {
  return db.transaction(async (tx) => {
    const batchRows = await tx.select().from(collectionBatches).where(eq(collectionBatches.id, id)).limit(1);
    const batch = batchRows[0];
    if (!batch) throw new Error("Batch not found");
    if (batch.status === CollectionBatchStatus.Approved || batch.status === CollectionBatchStatus.Rejected) {
      throw new Error("Only a pending or verified batch can be approved");
    }

    const entryRows = await tx.select().from(collectionEntries).where(eq(collectionEntries.batchId, id));
    const createdAt = todayIso();
    const rejectedEntries: { serialNo: number; error: string }[] = [];

    for (const entry of entryRows) {
      const customerRows = await tx.select().from(customers).where(eq(customers.id, entry.customerId)).limit(1);
      const customer = customerRows[0];
      const saleRows = customer?.saleId ? await tx.select().from(sales).where(eq(sales.id, customer.saleId)).limit(1) : [];
      const sale = saleRows[0];
      const error = evaluateEntry(customer, sale, entry.amountPaise);
      if (error || !customer || !sale) {
        await tx.update(collectionEntries).set({ error: error ?? "Invalid entry" }).where(eq(collectionEntries.id, entry.id));
        rejectedEntries.push({ serialNo: entry.serialNo, error: error ?? "Invalid entry" });
        continue;
      }

      const newBalance = sale.balancePaise - entry.amountPaise;
      await tx.update(sales).set({ balancePaise: newBalance }).where(eq(sales.id, sale.id));
      await tx.insert(ledgerEntries).values({
        id: genId("ledg"),
        customerId: customer.id,
        saleId: sale.id,
        date: batch.date,
        type: LedgerEntryType.Collection,
        debitPaise: 0,
        creditPaise: entry.amountPaise,
        balanceAfterPaise: newBalance,
        collectedBy: batch.collectorName,
        note: null,
        createdAt,
      });
      if (newBalance <= 0) {
        await tx.update(customers).set({ status: CustomerStatus.Inactive }).where(eq(customers.id, customer.id));
      }
    }

    await tx.update(collectionBatches).set({ status: CollectionBatchStatus.Approved }).where(eq(collectionBatches.id, id));

    const finalEntryRows = await tx.select().from(collectionEntries).where(eq(collectionEntries.batchId, id));
    const finalBatchRows = await tx.select().from(collectionBatches).where(eq(collectionBatches.id, id)).limit(1);
    const resultBatch = toBatch(finalBatchRows[0]!, finalEntryRows.map(toEntry));
    return { batch: resultBatch, rejectedEntries };
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Reverses the ledger/balance effect of every entry in an APPROVED batch — restores each
 * sale's balance, reactivates a customer that was auto-inactivated by this batch, and inserts
 * an offsetting ledger entry per original entry so the reversal itself is auditable. Shared by
 * deleteCollectionBatch (batch removed) and reopenCollectionBatch (batch unlocked for correction).
 */
async function reverseApprovedBatchLedgerEffects(
  tx: Tx,
  batch: typeof collectionBatches.$inferSelect,
  entryRows: (typeof collectionEntries.$inferSelect)[],
  note: string,
): Promise<void> {
  const createdAt = todayIso();
  for (const entry of entryRows) {
    const customerRows = await tx.select().from(customers).where(eq(customers.id, entry.customerId)).limit(1);
    const customer = customerRows[0];
    if (!customer?.saleId) continue;
    const saleRows = await tx.select().from(sales).where(eq(sales.id, customer.saleId)).limit(1);
    const sale = saleRows[0];
    if (!sale) continue;

    const wasInactive = customer.status === CustomerStatus.Inactive;
    const newBalance = sale.balancePaise + entry.amountPaise;
    await tx.update(sales).set({ balancePaise: newBalance }).where(eq(sales.id, sale.id));
    if (wasInactive && newBalance > 0) {
      await tx.update(customers).set({ status: CustomerStatus.Active }).where(eq(customers.id, customer.id));
    }
    await tx.insert(ledgerEntries).values({
      id: genId("ledg"),
      customerId: customer.id,
      saleId: sale.id,
      date: createdAt,
      type: LedgerEntryType.Collection,
      debitPaise: entry.amountPaise,
      creditPaise: 0,
      balanceAfterPaise: newBalance,
      collectedBy: null,
      note,
      createdAt,
    });
  }
}

/** Soft-delete: reverses every posted entry's effect on the ledger/balances, then marks the batch Rejected. */
export async function deleteCollectionBatch(id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const batchRows = await tx.select().from(collectionBatches).where(eq(collectionBatches.id, id)).limit(1);
    const batch = batchRows[0];
    if (!batch) throw new Error("Batch not found");

    if (batch.status === CollectionBatchStatus.Approved) {
      const entryRows = await tx.select().from(collectionEntries).where(eq(collectionEntries.batchId, id));
      await reverseApprovedBatchLedgerEffects(tx, batch, entryRows, "Collection batch deleted — entry reversed");
    }

    await tx.update(collectionBatches).set({ status: CollectionBatchStatus.Rejected }).where(eq(collectionBatches.id, id));
  });
}

/**
 * Admin-only correction path: unlocks an already-submitted (non-DRAFT) batch so the collector
 * can fix a mistaken amount. An APPROVED batch has already posted to the ledger, so its effect
 * is reversed first (see reverseApprovedBatchLedgerEffects) — otherwise re-approving the
 * corrected batch would post on top of the original and double-count it. PENDING/VERIFIED/
 * REJECTED batches never posted, so there's nothing to reverse. reopenedAt is set permanently
 * (never cleared) as a "this batch was corrected" marker, and is what excludes the batch from
 * the day-close gate while it sits DRAFT again (see listUnsubmittedPriorDayBatches).
 */
export async function reopenCollectionBatch(id: string, reopenedByName: string): Promise<CollectionBatch> {
  return db.transaction(async (tx) => {
    const batchRows = await tx.select().from(collectionBatches).where(eq(collectionBatches.id, id)).limit(1);
    const batch = batchRows[0];
    if (!batch) throw new Error("Batch not found");
    if (batch.status === CollectionBatchStatus.Draft) throw new Error("Batch is already editable");

    if (batch.status === CollectionBatchStatus.Approved) {
      const entryRows = await tx.select().from(collectionEntries).where(eq(collectionEntries.batchId, id));
      await reverseApprovedBatchLedgerEffects(tx, batch, entryRows, "Collection batch reopened for edit — entry reversed");
    }

    const reopenedAt = new Date().toISOString();
    await tx
      .update(collectionBatches)
      .set({ status: CollectionBatchStatus.Draft, reopenedAt, reopenedByName })
      .where(eq(collectionBatches.id, id));

    const entryRows = await tx.select().from(collectionEntries).where(eq(collectionEntries.batchId, id));
    return toBatch({ ...batch, status: CollectionBatchStatus.Draft, reopenedAt, reopenedByName }, entryRows.map(toEntry));
  });
}
