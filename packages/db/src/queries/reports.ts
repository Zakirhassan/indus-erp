/**
 * Reports engine. A handful of parameterized "engines" (Sales, Collections,
 * Outstanding/Aging, Customers, Finance, Inventory, Returns, Statements) sliced
 * by common filters (date range, field, product, collector) instead of one
 * function per named report — see docs discussion this module implements.
 *
 * Data volumes here are shop-scale (hundreds to low thousands of customers),
 * so these load the relevant rows and aggregate in memory rather than
 * building complex SQL — consistent with the rest of @indus/db.
 */
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import {
  CollectionBatchStatus,
  CustomerStatus,
  LedgerEntryType,
  Role,
  type Occurrence
} from "@indus/shared-types";
import { db } from "../client.js";
import {
  collectionBatches,
  collectionEntries,
  customers,
  fields,
  ledgerEntries,
  products,
  returns,
  saleItems,
  sales,
  users
} from "../schema.js";
import {
  agingBucket,
  computeScheduleStatus,
  daysBetween,
  todayIsoUtc,
  type ScheduleStatus
} from "./scheduleMath.js";

// ---------------------------------------------------------------------------
// Shared filter/date helpers
// ---------------------------------------------------------------------------

export interface DateRangeFilter {
  dateFrom?: string;
  dateTo?: string;
  fieldId?: string;
}

function monthStartIso(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}
function yearStartIso(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1)).toISOString().slice(0, 10);
}
function todayIso(): string {
  return todayIsoUtc();
}

/** [from, to] of the immediately-preceding period of equal length, for compare mode. */
function previousPeriod(dateFrom: string, dateTo: string): { from: string; to: string } {
  const lengthDays = daysBetween(dateFrom, dateTo) + 1;
  const to = new Date(`${dateFrom}T00:00:00Z`);
  to.setUTCDate(to.getUTCDate() - 1);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (lengthDays - 1));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null; // undefined growth from a zero base
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// ---------------------------------------------------------------------------
// Bulk loaders (shared across engines to avoid repeat round-trips)
// ---------------------------------------------------------------------------

async function loadFields() {
  return db.select().from(fields);
}

async function loadCustomers(fieldId?: string) {
  return fieldId
    ? db.select().from(customers).where(eq(customers.fieldId, fieldId))
    : db.select().from(customers);
}

async function loadSalesByCustomerIds(customerIds: string[]) {
  if (customerIds.length === 0) return [];
  return db.select().from(sales).where(inArray(sales.customerId, customerIds));
}

async function loadLedgerByCustomerIds(customerIds: string[], range?: DateRangeFilter) {
  if (customerIds.length === 0) return [];
  const conditions = [inArray(ledgerEntries.customerId, customerIds)];
  if (range?.dateFrom) conditions.push(gte(ledgerEntries.date, range.dateFrom));
  if (range?.dateTo) conditions.push(lte(ledgerEntries.date, range.dateTo));
  return db
    .select()
    .from(ledgerEntries)
    .where(and(...conditions));
}

function sumBy<T>(rows: T[], fn: (row: T) => number): number {
  return rows.reduce((s, r) => s + fn(r), 0);
}

function groupBy<T, K extends string>(rows: T[], keyFn: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const k = keyFn(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

/** Everything a per-customer schedule computation needs, pre-joined. */
interface CustomerScheduleRow {
  customer: typeof customers.$inferSelect;
  sale: typeof sales.$inferSelect;
  status: ScheduleStatus;
  collectedSincePaise: number;
}

async function loadActiveSchedules(
  fieldId: string | undefined,
  asOfDate: string
): Promise<CustomerScheduleRow[]> {
  const customerRows = await loadCustomers(fieldId);
  const active = customerRows.filter((c) => c.status === CustomerStatus.Active && c.saleId);
  const saleRows = await loadSalesByCustomerIds(active.map((c) => c.id));
  const saleByCustomerId = new Map(saleRows.map((s) => [s.customerId, s]));
  const ledgerRows = await loadLedgerByCustomerIds(active.map((c) => c.id));
  const collectedByCustomerId = new Map<string, number>();
  for (const entry of ledgerRows) {
    if (entry.type !== LedgerEntryType.Collection) continue;
    collectedByCustomerId.set(
      entry.customerId,
      (collectedByCustomerId.get(entry.customerId) ?? 0) + entry.creditPaise
    );
  }

  const out: CustomerScheduleRow[] = [];
  for (const customer of active) {
    const sale = saleByCustomerId.get(customer.id);
    if (!sale) continue;
    const collectedSincePaise = collectedByCustomerId.get(customer.id) ?? 0;
    const status = computeScheduleStatus(
      {
        saleDate: sale.saleDate,
        advancePaise: sale.advancePaise,
        occurrence: sale.occurrence as Occurrence,
        durationCount: sale.durationCount,
        regularInstallmentPaise: sale.regularInstallmentPaise,
        finalInstallmentPaise: sale.finalInstallmentPaise
      },
      collectedSincePaise,
      asOfDate
    );
    out.push({ customer, sale, status, collectedSincePaise });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. Overview / Management Dashboard
// ---------------------------------------------------------------------------

export interface ReportsOverview {
  asOfDate: string;
  totals: {
    totalCustomers: number;
    activeCustomers: number;
    inactiveCustomers: number;
    newCustomersMtd: number;
    completedCustomers: number; // inactive, fully paid, no return
    returnedCustomers: number; // has a returns row
    totalSalesMtdPaise: number;
    totalSalesYtdPaise: number;
    cashSalesMtdPaise: number; // advance covered the full amount at sale time
    financeSalesMtdPaise: number;
    totalCollectionsMtdPaise: number;
    totalOutstandingPaise: number;
    totalInventoryValuePaise: number; // at selling price
    grossProfitMtdPaise: number | null; // null if no product on file has a cost price
  };
  topFields: {
    fieldCode: string;
    collectedMtdPaise: number;
    outstandingPaise: number;
    collectionRatePct: number;
  }[];
  weakestFields: {
    fieldCode: string;
    collectedMtdPaise: number;
    outstandingPaise: number;
    collectionRatePct: number;
  }[];
  topProducts: {
    productId: string;
    name: string;
    type: string;
    qtySold90d: number;
    revenue90dPaise: number;
  }[];
  slowProducts: {
    productId: string;
    name: string;
    type: string;
    qtySold90d: number;
    quantity: number;
  }[];
  highestOutstandingCustomers: {
    customerId: string;
    name: string;
    fieldCode: string;
    serialNo: number;
    balancePaise: number;
    daysOverdue: number;
  }[];
  salesTrend: { month: string; salesPaise: number }[];
  collectionTrend: { month: string; collectedPaise: number }[];
  customerGrowthTrend: { month: string; newCustomers: number }[];
  businessHealthScore: number; // 0-100, see computeHealthScore
}

function last6Months(asOf: Date): { key: string; from: string; to: string }[] {
  const out: { key: string; from: string; to: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - i, 1));
    const from = d.toISOString().slice(0, 10);
    const to = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
      .toISOString()
      .slice(0, 10);
    out.push({ key: from.slice(0, 7), from, to });
  }
  return out;
}

/**
 * Transparent 0-100 composite: 60% weight on this month's collection rate
 * (collected / (collected + outstanding-due-so-far)), 40% weight on the
 * inverse of the overdue ratio (active customers currently overdue / active
 * customers). Not a statistically validated score — a legible at-a-glance
 * signal, documented so it can be reweighted later without surprise.
 */
function computeHealthScore(collectionRatePct: number, overdueRatioPct: number): number {
  const score = collectionRatePct * 0.6 + (100 - overdueRatioPct) * 0.4;
  return Math.round(Math.max(0, Math.min(100, score)));
}

export async function getReportsOverview(asOfDate: string = todayIso()): Promise<ReportsOverview> {
  const mtdStart = monthStartIso(new Date(`${asOfDate}T00:00:00Z`));
  const ytdStart = yearStartIso(new Date(`${asOfDate}T00:00:00Z`));

  const fieldRows = await loadFields();
  const customerRows = await loadCustomers();
  const saleRows = await loadSalesByCustomerIds(customerRows.map((c) => c.id));
  const saleByCustomerId = new Map(saleRows.map((s) => [s.customerId, s]));
  const returnRows = await db.select().from(returns);
  const returnedCustomerIds = new Set(returnRows.map((r) => r.customerId));

  const ledgerRowsMtd = await loadLedgerByCustomerIds(
    customerRows.map((c) => c.id),
    { dateFrom: mtdStart, dateTo: asOfDate }
  );
  const collectionsMtd = ledgerRowsMtd.filter((e) => e.type === LedgerEntryType.Collection);
  const totalCollectionsMtdPaise = sumBy(collectionsMtd, (e) => e.creditPaise);

  const salesMtd = saleRows.filter((s) => s.saleDate >= mtdStart && s.saleDate <= asOfDate);
  const salesYtd = saleRows.filter((s) => s.saleDate >= ytdStart && s.saleDate <= asOfDate);
  const totalSalesMtdPaise = sumBy(salesMtd, (s) => s.finalAmountPaise);
  const totalSalesYtdPaise = sumBy(salesYtd, (s) => s.finalAmountPaise);
  const cashSalesMtdPaise = sumBy(
    salesMtd.filter((s) => s.advancePaise >= s.finalAmountPaise),
    (s) => s.finalAmountPaise
  );
  const financeSalesMtdPaise = totalSalesMtdPaise - cashSalesMtdPaise;

  const totalOutstandingPaise = sumBy(saleRows, (s) => s.balancePaise);

  const productRows = await db.select().from(products);
  const totalInventoryValuePaise = sumBy(productRows, (p) => p.quantity * p.pricePaise);

  const saleItemRows90d = await db
    .select({
      productId: saleItems.productId,
      quantity: saleItems.quantity,
      subtotalPaise: saleItems.subtotalPaise,
      saleDate: sales.saleDate
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(gte(sales.saleDate, addDaysIsoLocal(asOfDate, -90)));
  const costByProductId = new Map(productRows.map((p) => [p.id, p.costPricePaise]));
  let grossProfitMtdPaise: number | null = null;
  const anyCostKnown = productRows.some((p) => p.costPricePaise !== null);
  if (anyCostKnown) {
    const mtdItemRows = await db
      .select({
        productId: saleItems.productId,
        quantity: saleItems.quantity,
        subtotalPaise: saleItems.subtotalPaise
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(and(gte(sales.saleDate, mtdStart), lte(sales.saleDate, asOfDate)));
    let revenue = 0;
    let cogs = 0;
    for (const row of mtdItemRows) {
      revenue += row.subtotalPaise;
      const cost = costByProductId.get(row.productId);
      if (cost !== null && cost !== undefined) cogs += cost * row.quantity;
    }
    grossProfitMtdPaise = revenue - cogs;
  }

  const newCustomersMtd = customerRows.filter(
    (c) => c.createdAt >= mtdStart && c.createdAt <= asOfDate
  ).length;
  const activeCustomers = customerRows.filter((c) => c.status === CustomerStatus.Active).length;
  const inactiveCustomers = customerRows.filter((c) => c.status === CustomerStatus.Inactive).length;
  const returnedCustomers = customerRows.filter(
    (c) => c.status === CustomerStatus.Inactive && returnedCustomerIds.has(c.id)
  ).length;
  const completedCustomers = inactiveCustomers - returnedCustomers;

  const byFieldStats = fieldRows.map((field) => {
    const fieldCustomers = customerRows.filter((c) => c.fieldId === field.id);
    const outstanding = sumBy(fieldCustomers, (c) => saleByCustomerId.get(c.id)?.balancePaise ?? 0);
    const collected = sumBy(
      collectionsMtd.filter((e) => fieldCustomers.some((c) => c.id === e.customerId)),
      (e) => e.creditPaise
    );
    const denom = collected + outstanding;
    return {
      fieldCode: field.code,
      collectedMtdPaise: collected,
      outstandingPaise: outstanding,
      collectionRatePct: denom > 0 ? Math.round((collected / denom) * 100) : 100
    };
  });
  const sortedByRate = [...byFieldStats].sort((a, b) => b.collectionRatePct - a.collectionRatePct);
  const topFields = sortedByRate.slice(0, 5);
  const weakestFields = [...sortedByRate].reverse().slice(0, 5);

  const qtyByProduct = new Map<string, number>();
  const revenueByProduct = new Map<string, number>();
  for (const item of saleItemRows90d) {
    qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.quantity);
    revenueByProduct.set(
      item.productId,
      (revenueByProduct.get(item.productId) ?? 0) + item.subtotalPaise
    );
  }
  const productStats = productRows.map((p) => ({
    productId: p.id,
    name: p.name,
    type: p.type,
    qtySold90d: qtyByProduct.get(p.id) ?? 0,
    revenue90dPaise: revenueByProduct.get(p.id) ?? 0,
    quantity: p.quantity
  }));
  const topProducts = [...productStats].sort((a, b) => b.qtySold90d - a.qtySold90d).slice(0, 10);
  const slowProducts = [...productStats]
    .filter((p) => p.quantity > 0)
    .sort((a, b) => a.qtySold90d - b.qtySold90d)
    .slice(0, 10);

  const activeSchedules = await loadActiveSchedules(undefined, asOfDate);
  const highestOutstandingCustomers = [...customerRows]
    .map((c) => ({ customer: c, sale: saleByCustomerId.get(c.id) }))
    .filter(
      (r): r is { customer: typeof customers.$inferSelect; sale: typeof sales.$inferSelect } =>
        !!r.sale && r.sale.balancePaise > 0
    )
    .sort((a, b) => b.sale.balancePaise - a.sale.balancePaise)
    .slice(0, 10)
    .map((r) => {
      const schedule = activeSchedules.find((s) => s.customer.id === r.customer.id);
      return {
        customerId: r.customer.id,
        name: r.customer.name,
        fieldCode: r.customer.fieldCode,
        serialNo: r.customer.serialNo,
        balancePaise: r.sale.balancePaise,
        daysOverdue: schedule?.status.daysOverdue ?? 0
      };
    });

  const months = last6Months(new Date(`${asOfDate}T00:00:00Z`));
  const allLedgerForTrend = await loadLedgerByCustomerIds(
    customerRows.map((c) => c.id),
    {
      dateFrom: months[0]!.from,
      dateTo: asOfDate
    }
  );
  const salesTrend = months.map((m) => ({
    month: m.key,
    salesPaise: sumBy(
      saleRows.filter((s) => s.saleDate >= m.from && s.saleDate <= m.to),
      (s) => s.finalAmountPaise
    )
  }));
  const collectionTrend = months.map((m) => ({
    month: m.key,
    collectedPaise: sumBy(
      allLedgerForTrend.filter(
        (e) => e.type === LedgerEntryType.Collection && e.date >= m.from && e.date <= m.to
      ),
      (e) => e.creditPaise
    )
  }));
  const customerGrowthTrend = months.map((m) => ({
    month: m.key,
    newCustomers: customerRows.filter((c) => c.createdAt >= m.from && c.createdAt <= m.to).length
  }));

  const overallDenom = totalCollectionsMtdPaise + totalOutstandingPaise;
  const overallCollectionRatePct =
    overallDenom > 0 ? (totalCollectionsMtdPaise / overallDenom) * 100 : 100;
  const overdueActive = activeSchedules.filter((s) => s.status.isOverdue).length;
  const overdueRatioPct =
    activeSchedules.length > 0 ? (overdueActive / activeSchedules.length) * 100 : 0;
  const businessHealthScore = computeHealthScore(overallCollectionRatePct, overdueRatioPct);

  return {
    asOfDate,
    totals: {
      totalCustomers: customerRows.length,
      activeCustomers,
      inactiveCustomers,
      newCustomersMtd,
      completedCustomers,
      returnedCustomers,
      totalSalesMtdPaise,
      totalSalesYtdPaise,
      cashSalesMtdPaise,
      financeSalesMtdPaise,
      totalCollectionsMtdPaise,
      totalOutstandingPaise,
      totalInventoryValuePaise,
      grossProfitMtdPaise
    },
    topFields,
    weakestFields,
    topProducts: topProducts.map(({ quantity: _quantity, ...rest }) => rest),
    slowProducts,
    highestOutstandingCustomers,
    salesTrend,
    collectionTrend,
    customerGrowthTrend,
    businessHealthScore
  };
}

function addDaysIsoLocal(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// 2. Sales report
// ---------------------------------------------------------------------------

export interface SalesReportParams extends DateRangeFilter {
  productType?: string;
  compare?: boolean;
}

export interface SalesReportTotals {
  grossPaise: number;
  discountPaise: number;
  netPaise: number;
  cashPaise: number;
  financePaise: number;
  advancePaise: number;
  saleCount: number;
  avgSaleValuePaise: number;
}

export interface SalesReport {
  range: { from: string; to: string };
  totals: SalesReportTotals;
  previous?: {
    range: { from: string; to: string };
    totals: SalesReportTotals;
    growthPct: number | null;
  };
  byDay: { date: string; netPaise: number; count: number }[];
  byField: { fieldCode: string; netPaise: number; count: number }[];
  byProduct: { productId: string; name: string; type: string; qty: number; revenuePaise: number }[];
  byCategory: { type: string; qty: number; revenuePaise: number }[];
}

async function computeSalesTotals(
  dateFrom: string,
  dateTo: string,
  fieldId?: string
): Promise<{
  totals: SalesReportTotals;
  byDay: SalesReport["byDay"];
  byField: SalesReport["byField"];
}> {
  const customerRows = await loadCustomers(fieldId);
  const customerById = new Map(customerRows.map((c) => [c.id, c]));
  const allSales = await loadSalesByCustomerIds(customerRows.map((c) => c.id));
  const inRange = allSales.filter((s) => s.saleDate >= dateFrom && s.saleDate <= dateTo);

  const grossPaise = sumBy(inRange, (s) => s.totalPaise);
  const discountPaise = sumBy(inRange, (s) => s.discountPaise);
  const netPaise = sumBy(inRange, (s) => s.finalAmountPaise);
  const cashPaise = sumBy(
    inRange.filter((s) => s.advancePaise >= s.finalAmountPaise),
    (s) => s.finalAmountPaise
  );
  const financePaise = netPaise - cashPaise;
  const advancePaise = sumBy(inRange, (s) => s.advancePaise);
  const saleCount = inRange.length;

  const byDayMap = groupBy(inRange, (s) => s.saleDate);
  const byDay = [...byDayMap.entries()]
    .map(([date, rows]) => ({
      date,
      netPaise: sumBy(rows, (r) => r.finalAmountPaise),
      count: rows.length
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byFieldMap = groupBy(inRange, (s) => customerById.get(s.customerId)?.fieldCode ?? "?");
  const byField = [...byFieldMap.entries()]
    .map(([fieldCode, rows]) => ({
      fieldCode,
      netPaise: sumBy(rows, (r) => r.finalAmountPaise),
      count: rows.length
    }))
    .sort((a, b) => b.netPaise - a.netPaise);

  return {
    totals: {
      grossPaise,
      discountPaise,
      netPaise,
      cashPaise,
      financePaise,
      advancePaise,
      saleCount,
      avgSaleValuePaise: saleCount > 0 ? Math.round(netPaise / saleCount) : 0
    },
    byDay,
    byField
  };
}

export async function getSalesReport(params: SalesReportParams): Promise<SalesReport> {
  const dateFrom = params.dateFrom ?? monthStartIso();
  const dateTo = params.dateTo ?? todayIso();

  const { totals, byDay, byField } = await computeSalesTotals(dateFrom, dateTo, params.fieldId);

  const customerRows = await loadCustomers(params.fieldId);
  const allSales = await loadSalesByCustomerIds(customerRows.map((c) => c.id));
  const inRangeSaleIds = allSales
    .filter((s) => s.saleDate >= dateFrom && s.saleDate <= dateTo)
    .map((s) => s.id);
  const itemRows = inRangeSaleIds.length
    ? await db.select().from(saleItems).where(inArray(saleItems.saleId, inRangeSaleIds))
    : [];
  const productRows = await db.select().from(products);
  const productById = new Map(productRows.map((p) => [p.id, p]));

  const filteredItems = params.productType
    ? itemRows.filter((i) => productById.get(i.productId)?.type === params.productType)
    : itemRows;

  const byProductMap = groupBy(filteredItems, (i) => i.productId);
  const byProduct = [...byProductMap.entries()]
    .map(([productId, rows]) => {
      const product = productById.get(productId);
      return {
        productId,
        name: product?.name ?? "Unknown",
        type: product?.type ?? "Unknown",
        qty: sumBy(rows, (r) => r.quantity),
        revenuePaise: sumBy(rows, (r) => r.subtotalPaise)
      };
    })
    .sort((a, b) => b.revenuePaise - a.revenuePaise);

  const byCategoryMap = groupBy(
    filteredItems,
    (i) => productById.get(i.productId)?.type ?? "Unknown"
  );
  const byCategory = [...byCategoryMap.entries()]
    .map(([type, rows]) => ({
      type,
      qty: sumBy(rows, (r) => r.quantity),
      revenuePaise: sumBy(rows, (r) => r.subtotalPaise)
    }))
    .sort((a, b) => b.revenuePaise - a.revenuePaise);

  const result: SalesReport = {
    range: { from: dateFrom, to: dateTo },
    totals,
    byDay,
    byField,
    byProduct,
    byCategory
  };

  if (params.compare) {
    const prev = previousPeriod(dateFrom, dateTo);
    const prevTotals = (await computeSalesTotals(prev.from, prev.to, params.fieldId)).totals;
    result.previous = {
      range: prev,
      totals: prevTotals,
      growthPct: pctChange(totals.netPaise, prevTotals.netPaise)
    };
  }

  return result;
}

// ---------------------------------------------------------------------------
// 3. Collections report
// ---------------------------------------------------------------------------

export interface CollectionsReportParams extends DateRangeFilter {
  collectorId?: string;
}

export interface CollectionsReport {
  range: { from: string; to: string };
  totals: {
    collectedPaise: number;
    batchCount: number;
    customerCount: number;
    avgPerCustomerPaise: number;
    missedCount: number;
    partialCount: number;
  };
  byDay: { date: string; collectedPaise: number }[];
  byField: { fieldCode: string; collectedPaise: number }[];
  byCollector: { collectorName: string; collectedPaise: number; batchCount: number }[];
}

export async function getCollectionsReport(
  params: CollectionsReportParams
): Promise<CollectionsReport> {
  const dateFrom = params.dateFrom ?? monthStartIso();
  const dateTo = params.dateTo ?? todayIso();

  const batchConditions = [
    eq(collectionBatches.status, CollectionBatchStatus.Approved),
    gte(collectionBatches.date, dateFrom),
    lte(collectionBatches.date, dateTo)
  ];
  if (params.fieldId) batchConditions.push(eq(collectionBatches.fieldId, params.fieldId));
  if (params.collectorId)
    batchConditions.push(eq(collectionBatches.collectorId, params.collectorId));
  const batchRows = await db
    .select()
    .from(collectionBatches)
    .where(and(...batchConditions));

  const entryRows = batchRows.length
    ? await db
        .select()
        .from(collectionEntries)
        .where(
          inArray(
            collectionEntries.batchId,
            batchRows.map((b) => b.id)
          )
        )
    : [];
  const collectedPaise = sumBy(entryRows, (e) => e.amountPaise);
  const customerCount = new Set(entryRows.map((e) => e.customerId)).size;

  const byDayMap = groupBy(batchRows, (b) => b.date);
  const byDay = [...byDayMap.entries()]
    .map(([date, rows]) => ({ date, collectedPaise: sumBy(rows, (r) => r.totalAmountPaise) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byFieldMap = groupBy(batchRows, (b) => b.fieldCode);
  const byField = [...byFieldMap.entries()]
    .map(([fieldCode, rows]) => ({
      fieldCode,
      collectedPaise: sumBy(rows, (r) => r.totalAmountPaise)
    }))
    .sort((a, b) => b.collectedPaise - a.collectedPaise);

  const byCollectorMap = groupBy(batchRows, (b) => b.collectorName ?? "Direct (Admin)");
  const byCollector = [...byCollectorMap.entries()]
    .map(([collectorName, rows]) => ({
      collectorName,
      collectedPaise: sumBy(rows, (r) => r.totalAmountPaise),
      batchCount: rows.length
    }))
    .sort((a, b) => b.collectedPaise - a.collectedPaise);

  // Missed/partial: among customers active as of dateTo in scope, compare what
  // should have been collected within [dateFrom, dateTo] vs what was.
  const schedulesAtTo = await loadActiveSchedules(params.fieldId, dateTo);
  const schedulesAtFromMap = new Map(
    (await loadActiveSchedules(params.fieldId, addDaysIsoLocal(dateFrom, -1))).map((s) => [
      s.customer.id,
      s.status.expectedPaidPaise
    ])
  );
  const collectedByCustomerInRange = new Map<string, number>();
  for (const e of entryRows)
    collectedByCustomerInRange.set(
      e.customerId,
      (collectedByCustomerInRange.get(e.customerId) ?? 0) + e.amountPaise
    );

  let missedCount = 0;
  let partialCount = 0;
  for (const s of schedulesAtTo) {
    const expectedAtFrom = schedulesAtFromMap.get(s.customer.id) ?? s.status.expectedPaidPaise;
    const expectedDelta = s.status.expectedPaidPaise - expectedAtFrom;
    if (expectedDelta <= 0) continue;
    const collected = collectedByCustomerInRange.get(s.customer.id) ?? 0;
    if (collected === 0) missedCount++;
    else if (collected < expectedDelta) partialCount++;
  }

  return {
    range: { from: dateFrom, to: dateTo },
    totals: {
      collectedPaise,
      batchCount: batchRows.length,
      customerCount,
      avgPerCustomerPaise: customerCount > 0 ? Math.round(collectedPaise / customerCount) : 0,
      missedCount,
      partialCount
    },
    byDay,
    byField,
    byCollector
  };
}

// ---------------------------------------------------------------------------
// 4. Outstanding / Aging report
// ---------------------------------------------------------------------------

export interface OutstandingReportParams {
  fieldId?: string;
  asOfDate?: string;
}

export interface OutstandingCustomerRow {
  customerId: string;
  fieldCode: string;
  serialNo: number;
  name: string;
  phone: string;
  balancePaise: number;
  daysOverdue: number;
  bucket: "current" | "0-30" | "31-60" | "61-90" | "90+";
  nextDueDate: string;
}

export interface OutstandingReport {
  asOfDate: string;
  totals: { totalOutstandingPaise: number };
  aging: { bucket: string; amountPaise: number; count: number }[];
  byField: { fieldCode: string; outstandingPaise: number; overdueCount: number }[];
  customers: OutstandingCustomerRow[];
}

export async function getOutstandingReport(
  params: OutstandingReportParams
): Promise<OutstandingReport> {
  const asOfDate = params.asOfDate ?? todayIso();
  const schedules = await loadActiveSchedules(params.fieldId, asOfDate);

  const customerRows: OutstandingCustomerRow[] = schedules
    .filter((s) => s.sale.balancePaise > 0)
    .map((s) => ({
      customerId: s.customer.id,
      fieldCode: s.customer.fieldCode,
      serialNo: s.customer.serialNo,
      name: s.customer.name,
      phone: s.customer.phone,
      balancePaise: s.sale.balancePaise,
      daysOverdue: s.status.daysOverdue,
      bucket: agingBucket(s.status.daysOverdue),
      nextDueDate: s.status.nextDueDate
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue || b.balancePaise - a.balancePaise);

  const totalOutstandingPaise = sumBy(customerRows, (c) => c.balancePaise);

  const bucketOrder = ["current", "0-30", "31-60", "61-90", "90+"] as const;
  const aging = bucketOrder.map((bucket) => {
    const rows = customerRows.filter((c) => c.bucket === bucket);
    return { bucket, amountPaise: sumBy(rows, (r) => r.balancePaise), count: rows.length };
  });

  const byFieldMap = groupBy(customerRows, (c) => c.fieldCode);
  const byField = [...byFieldMap.entries()]
    .map(([fieldCode, rows]) => ({
      fieldCode,
      outstandingPaise: sumBy(rows, (r) => r.balancePaise),
      overdueCount: rows.filter((r) => r.daysOverdue > 0).length
    }))
    .sort((a, b) => b.outstandingPaise - a.outstandingPaise);

  return { asOfDate, totals: { totalOutstandingPaise }, aging, byField, customers: customerRows };
}

// ---------------------------------------------------------------------------
// 5. Customers report (status mix, acquisition, attention lists)
// ---------------------------------------------------------------------------

export interface CustomersReportParams {
  fieldId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface AttentionCustomer {
  customerId: string;
  fieldCode: string;
  serialNo: number;
  name: string;
  phone: string;
  balancePaise: number;
  daysOverdue: number;
  daysSinceLastCollection: number | null;
}

export interface CustomersReport {
  counts: {
    total: number;
    active: number;
    inactive: number;
    completed: number;
    returned: number;
    newInRange: number;
  };
  acquisitionTrend: { month: string; count: number }[];
  attentionList: AttentionCustomer[]; // any overdue amount at all
  nonPerformingList: AttentionCustomer[]; // no collection in 60+ days despite active
}

export async function getCustomersReport(params: CustomersReportParams): Promise<CustomersReport> {
  const asOfDate = todayIso();
  const customerRows = await loadCustomers(params.fieldId);
  const returnRows = await db.select().from(returns);
  const returnedIds = new Set(returnRows.map((r) => r.customerId));

  const total = customerRows.length;
  const active = customerRows.filter((c) => c.status === CustomerStatus.Active).length;
  const inactive = customerRows.filter((c) => c.status === CustomerStatus.Inactive).length;
  const returned = customerRows.filter(
    (c) => c.status === CustomerStatus.Inactive && returnedIds.has(c.id)
  ).length;
  const completed = inactive - returned;
  const dateFrom = params.dateFrom ?? monthStartIso();
  const dateTo = params.dateTo ?? asOfDate;
  const newInRange = customerRows.filter(
    (c) => c.createdAt >= dateFrom && c.createdAt <= dateTo
  ).length;

  const months = last6Months(new Date(`${asOfDate}T00:00:00Z`));
  const acquisitionTrend = months.map((m) => ({
    month: m.key,
    count: customerRows.filter((c) => c.createdAt >= m.from && c.createdAt <= m.to).length
  }));

  const schedules = await loadActiveSchedules(params.fieldId, asOfDate);
  const ledgerRows = await loadLedgerByCustomerIds(schedules.map((s) => s.customer.id));
  const lastCollectionByCustomer = new Map<string, string>();
  for (const e of ledgerRows) {
    if (e.type !== LedgerEntryType.Collection) continue;
    const prev = lastCollectionByCustomer.get(e.customerId);
    if (!prev || e.date > prev) lastCollectionByCustomer.set(e.customerId, e.date);
  }

  const attentionList: AttentionCustomer[] = schedules
    .filter((s) => s.status.isOverdue)
    .map((s) => {
      const last = lastCollectionByCustomer.get(s.customer.id);
      return {
        customerId: s.customer.id,
        fieldCode: s.customer.fieldCode,
        serialNo: s.customer.serialNo,
        name: s.customer.name,
        phone: s.customer.phone,
        balancePaise: s.sale.balancePaise,
        daysOverdue: s.status.daysOverdue,
        daysSinceLastCollection: last ? daysBetween(last, asOfDate) : null
      };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const NON_PERFORMING_THRESHOLD_DAYS = 60;
  const nonPerformingList: AttentionCustomer[] = schedules
    .map((s) => {
      const last = lastCollectionByCustomer.get(s.customer.id);
      const daysSinceLastCollection = last
        ? daysBetween(last, asOfDate)
        : daysBetween(s.sale.saleDate, asOfDate);
      return {
        customerId: s.customer.id,
        fieldCode: s.customer.fieldCode,
        serialNo: s.customer.serialNo,
        name: s.customer.name,
        phone: s.customer.phone,
        balancePaise: s.sale.balancePaise,
        daysOverdue: s.status.daysOverdue,
        daysSinceLastCollection
      };
    })
    .filter(
      (c) =>
        c.daysSinceLastCollection !== null &&
        c.daysSinceLastCollection >= NON_PERFORMING_THRESHOLD_DAYS
    )
    .sort((a, b) => (b.daysSinceLastCollection ?? 0) - (a.daysSinceLastCollection ?? 0));

  return {
    counts: { total, active, inactive, completed, returned, newInRange },
    acquisitionTrend,
    attentionList,
    nonPerformingList
  };
}

// ---------------------------------------------------------------------------
// 6. Collect-today / due list — the "who do I collect from today" quick action
// ---------------------------------------------------------------------------

export interface CollectDueParams {
  fieldId?: string;
  asOfDate?: string;
}

export interface CollectDueRow {
  customerId: string;
  fieldCode: string;
  serialNo: number;
  name: string;
  phone: string;
  address: string;
  amountDuePaise: number;
  daysOverdue: number;
  status: "due-today" | "overdue";
}

export interface CollectDueReport {
  asOfDate: string;
  dueToday: CollectDueRow[];
  overdue: CollectDueRow[];
}

export async function getCollectDueReport(params: CollectDueParams): Promise<CollectDueReport> {
  const asOfDate = params.asOfDate ?? todayIso();
  const schedules = await loadActiveSchedules(params.fieldId, asOfDate);

  const dueToday: CollectDueRow[] = [];
  const overdue: CollectDueRow[] = [];
  for (const s of schedules) {
    const base = {
      customerId: s.customer.id,
      fieldCode: s.customer.fieldCode,
      serialNo: s.customer.serialNo,
      name: s.customer.name,
      phone: s.customer.phone,
      address: s.customer.address,
      daysOverdue: s.status.daysOverdue
    };
    if (s.status.isOverdue) {
      overdue.push({ ...base, amountDuePaise: s.status.overdueAmountPaise, status: "overdue" });
    } else if (s.status.isDueToday) {
      dueToday.push({
        ...base,
        amountDuePaise: s.sale.regularInstallmentPaise,
        status: "due-today"
      });
    }
  }
  overdue.sort((a, b) => b.daysOverdue - a.daysOverdue || b.amountDuePaise - a.amountDuePaise);
  dueToday.sort((a, b) => b.amountDuePaise - a.amountDuePaise);

  return { asOfDate, dueToday, overdue };
}

// ---------------------------------------------------------------------------
// 7. Finance & installments report
// ---------------------------------------------------------------------------

export type FinanceReportParams = DateRangeFilter;

export interface FinanceReport {
  range: { from: string; to: string };
  totals: {
    totalFinancedPaise: number; // sum of balance-at-sale for sales opened in range
    totalAdvancePaise: number;
    activeFinanceCount: number;
    completedFinanceCount: number;
    totalOutstandingPaise: number;
    recoveryRatePct: number; // collected-in-range / expected-in-range, all active accounts in scope
  };
  installments: {
    dueTodayCount: number;
    dueTodayPaise: number;
    overdueCount: number;
    overduePaise: number;
    upcoming7dCount: number;
    upcoming7dPaise: number;
  };
}

export async function getFinanceReport(params: FinanceReportParams): Promise<FinanceReport> {
  const dateFrom = params.dateFrom ?? monthStartIso();
  const dateTo = params.dateTo ?? todayIso();
  const asOfDate = todayIso();

  const customerRows = await loadCustomers(params.fieldId);
  const saleRows = await loadSalesByCustomerIds(customerRows.map((c) => c.id));
  const opened = saleRows.filter((s) => s.saleDate >= dateFrom && s.saleDate <= dateTo);
  const totalFinancedPaise = sumBy(opened, (s) => s.finalAmountPaise - s.advancePaise);
  const totalAdvancePaise = sumBy(opened, (s) => s.advancePaise);

  const activeCustomerIds = new Set(
    customerRows.filter((c) => c.status === CustomerStatus.Active).map((c) => c.id)
  );
  const activeFinanceCount = saleRows.filter(
    (s) => activeCustomerIds.has(s.customerId) && s.balancePaise > 0
  ).length;
  const completedFinanceCount = saleRows.filter((s) => s.balancePaise === 0).length;
  const totalOutstandingPaise = sumBy(saleRows, (s) => s.balancePaise);

  const schedules = await loadActiveSchedules(params.fieldId, dateTo);
  const schedulesAtFromMap = new Map(
    (await loadActiveSchedules(params.fieldId, addDaysIsoLocal(dateFrom, -1))).map((s) => [
      s.customer.id,
      s.status.expectedPaidPaise
    ])
  );
  const ledgerRows = await loadLedgerByCustomerIds(
    schedules.map((s) => s.customer.id),
    { dateFrom, dateTo }
  );
  const collectedInRange = sumBy(
    ledgerRows.filter((e) => e.type === LedgerEntryType.Collection),
    (e) => e.creditPaise
  );
  const expectedInRange = sumBy(
    schedules,
    (s) =>
      s.status.expectedPaidPaise -
      (schedulesAtFromMap.get(s.customer.id) ?? s.status.expectedPaidPaise)
  );
  const recoveryRatePct =
    expectedInRange > 0 ? Math.round((collectedInRange / expectedInRange) * 1000) / 10 : 100;

  const dueList = await getCollectDueReport({ fieldId: params.fieldId, asOfDate });
  const upcomingSchedules = await loadActiveSchedules(params.fieldId, addDaysIsoLocal(asOfDate, 7));
  const upcoming = upcomingSchedules.filter(
    (s) => s.status.nextDueDate > asOfDate && s.status.nextDueDate <= addDaysIsoLocal(asOfDate, 7)
  );

  return {
    range: { from: dateFrom, to: dateTo },
    totals: {
      totalFinancedPaise,
      totalAdvancePaise,
      activeFinanceCount,
      completedFinanceCount,
      totalOutstandingPaise,
      recoveryRatePct
    },
    installments: {
      dueTodayCount: dueList.dueToday.length,
      dueTodayPaise: sumBy(dueList.dueToday, (r) => r.amountDuePaise),
      overdueCount: dueList.overdue.length,
      overduePaise: sumBy(dueList.overdue, (r) => r.amountDuePaise),
      upcoming7dCount: upcoming.length,
      upcoming7dPaise: sumBy(upcoming, (s) => s.sale.regularInstallmentPaise)
    }
  };
}

// ---------------------------------------------------------------------------
// 8. Inventory & products report
// ---------------------------------------------------------------------------

export interface InventoryReportParams {
  type?: string;
}

export interface InventoryReport {
  totals: {
    totalStockUnits: number;
    totalValuationPaise: number;
    totalCostValuationPaise: number | null;
  };
  byCategory: { type: string; units: number; valuationPaise: number }[];
  lowStock: { productId: string; name: string; type: string; quantity: number }[];
  outOfStock: { productId: string; name: string; type: string }[];
  fastMoving: { productId: string; name: string; type: string; qtySold90d: number }[];
  slowMoving: {
    productId: string;
    name: string;
    type: string;
    qtySold90d: number;
    quantity: number;
  }[];
  deadStock: {
    productId: string;
    name: string;
    type: string;
    quantity: number;
    daysSinceLastSale: number | null;
  }[];
}

const LOW_STOCK_THRESHOLD = 5;
const DEAD_STOCK_DAYS = 180;

export async function getInventoryReport(params: InventoryReportParams): Promise<InventoryReport> {
  const asOfDate = todayIso();
  const allProducts = await db.select().from(products);
  const productRows = params.type ? allProducts.filter((p) => p.type === params.type) : allProducts;

  const totalStockUnits = sumBy(productRows, (p) => p.quantity);
  const totalValuationPaise = sumBy(productRows, (p) => p.quantity * p.pricePaise);
  const anyCostKnown = productRows.some((p) => p.costPricePaise !== null);
  const totalCostValuationPaise = anyCostKnown
    ? sumBy(productRows, (p) => p.quantity * (p.costPricePaise ?? 0))
    : null;

  const byCategoryMap = groupBy(productRows, (p) => p.type);
  const byCategory = [...byCategoryMap.entries()]
    .map(([type, rows]) => ({
      type,
      units: sumBy(rows, (r) => r.quantity),
      valuationPaise: sumBy(rows, (r) => r.quantity * r.pricePaise)
    }))
    .sort((a, b) => b.valuationPaise - a.valuationPaise);

  const lowStock = productRows
    .filter((p) => p.quantity > 0 && p.quantity < LOW_STOCK_THRESHOLD)
    .map((p) => ({ productId: p.id, name: p.name, type: p.type, quantity: p.quantity }));
  const outOfStock = productRows
    .filter((p) => p.quantity === 0)
    .map((p) => ({ productId: p.id, name: p.name, type: p.type }));

  const saleItemRows = await db
    .select({
      productId: saleItems.productId,
      quantity: saleItems.quantity,
      saleDate: sales.saleDate
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(gte(sales.saleDate, addDaysIsoLocal(asOfDate, -DEAD_STOCK_DAYS)));
  const qtyByProduct90d = new Map<string, number>();
  const lastSaleDateByProduct = new Map<string, string>();
  for (const row of saleItemRows) {
    if (row.saleDate >= addDaysIsoLocal(asOfDate, -90)) {
      qtyByProduct90d.set(row.productId, (qtyByProduct90d.get(row.productId) ?? 0) + row.quantity);
    }
    const prevLast = lastSaleDateByProduct.get(row.productId);
    if (!prevLast || row.saleDate > prevLast)
      lastSaleDateByProduct.set(row.productId, row.saleDate);
  }

  const withVelocity = productRows.map((p) => ({
    productId: p.id,
    name: p.name,
    type: p.type,
    qtySold90d: qtyByProduct90d.get(p.id) ?? 0,
    quantity: p.quantity,
    lastSaleDate: lastSaleDateByProduct.get(p.id) ?? null
  }));

  const fastMoving = [...withVelocity]
    .sort((a, b) => b.qtySold90d - a.qtySold90d)
    .slice(0, 10)
    .map(({ productId, name, type, qtySold90d }) => ({ productId, name, type, qtySold90d }));
  const slowMoving = withVelocity
    .filter((p) => p.quantity > 0)
    .sort((a, b) => a.qtySold90d - b.qtySold90d)
    .slice(0, 10)
    .map(({ productId, name, type, qtySold90d, quantity }) => ({
      productId,
      name,
      type,
      qtySold90d,
      quantity
    }));
  const deadStock = withVelocity
    .filter(
      (p) =>
        p.quantity > 0 &&
        (p.lastSaleDate === null || p.lastSaleDate < addDaysIsoLocal(asOfDate, -DEAD_STOCK_DAYS))
    )
    .map((p) => ({
      productId: p.productId,
      name: p.name,
      type: p.type,
      quantity: p.quantity,
      daysSinceLastSale: p.lastSaleDate ? daysBetween(p.lastSaleDate, asOfDate) : null
    }));

  return {
    totals: { totalStockUnits, totalValuationPaise, totalCostValuationPaise },
    byCategory,
    lowStock,
    outOfStock,
    fastMoving,
    slowMoving,
    deadStock
  };
}

// ---------------------------------------------------------------------------
// 9. Returns report
// ---------------------------------------------------------------------------

export interface ReturnsReportParams extends DateRangeFilter {
  productId?: string;
}

export interface ReturnsReport {
  range: { from: string; to: string };
  totals: { count: number; advanceRefundedPaise: number; returnRatePct: number };
  byDay: { date: string; count: number }[];
  byField: { fieldCode: string; count: number; advanceRefundedPaise: number }[];
  byProduct: { productId: string; name: string; count: number }[];
  byReason: { reason: string; count: number }[];
}

export async function getReturnsReport(params: ReturnsReportParams): Promise<ReturnsReport> {
  const dateFrom = params.dateFrom ?? monthStartIso();
  const dateTo = params.dateTo ?? todayIso();

  const customerRows = await loadCustomers(params.fieldId);
  const customerById = new Map(customerRows.map((c) => [c.id, c]));
  const allReturns = await db
    .select()
    .from(returns)
    .where(and(gte(returns.returnedAt, dateFrom), lte(returns.returnedAt, dateTo)));
  const scoped = params.fieldId
    ? allReturns.filter((r) => customerById.has(r.customerId))
    : allReturns;

  const totals = {
    count: scoped.length,
    advanceRefundedPaise: sumBy(scoped, (r) => r.advanceRefundedPaise),
    returnRatePct: 0
  };

  const allSalesInRange = (await loadSalesByCustomerIds(customerRows.map((c) => c.id))).filter(
    (s) => s.saleDate >= dateFrom && s.saleDate <= dateTo
  );
  totals.returnRatePct =
    allSalesInRange.length > 0
      ? Math.round((scoped.length / allSalesInRange.length) * 1000) / 10
      : 0;

  const byDayMap = groupBy(scoped, (r) => r.returnedAt.slice(0, 10));
  const byDay = [...byDayMap.entries()]
    .map(([date, rows]) => ({ date, count: rows.length }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byFieldMap = groupBy(scoped, (r) => customerById.get(r.customerId)?.fieldCode ?? "?");
  const byField = [...byFieldMap.entries()]
    .map(([fieldCode, rows]) => ({
      fieldCode,
      count: rows.length,
      advanceRefundedPaise: sumBy(rows, (r) => r.advanceRefundedPaise)
    }))
    .sort((a, b) => b.count - a.count);

  const saleIds = scoped.map((r) => r.saleId);
  const itemRows = saleIds.length
    ? await db.select().from(saleItems).where(inArray(saleItems.saleId, saleIds))
    : [];
  const itemsBySale = groupBy(itemRows, (i) => i.saleId);
  const productCounts = new Map<string, { name: string; count: number }>();
  for (const ret of scoped) {
    const items = itemsBySale.get(ret.saleId) ?? [];
    for (const item of items) {
      const entry = productCounts.get(item.productId) ?? { name: item.productName, count: 0 };
      entry.count += 1;
      productCounts.set(item.productId, entry);
    }
  }
  let byProduct = [...productCounts.entries()]
    .map(([productId, v]) => ({ productId, name: v.name, count: v.count }))
    .sort((a, b) => b.count - a.count);
  if (params.productId) byProduct = byProduct.filter((p) => p.productId === params.productId);

  const byReasonMap = groupBy(scoped, (r) => r.reason ?? "Not specified");
  const byReason = [...byReasonMap.entries()]
    .map(([reason, rows]) => ({ reason, count: rows.length }))
    .sort((a, b) => b.count - a.count);

  return { range: { from: dateFrom, to: dateTo }, totals, byDay, byField, byProduct, byReason };
}

// ---------------------------------------------------------------------------
// 10. Statements — P&L + balance sheet per field
// ---------------------------------------------------------------------------

export interface StatementsReportParams extends DateRangeFilter {
  compare?: boolean;
}

export interface StatementsTotals {
  revenuePaise: number;
  cogsPaise: number | null;
  grossProfitPaise: number | null;
  discountsPaise: number;
  collectionsPaise: number;
  outstandingEndPaise: number;
}

export interface StatementsReport {
  range: { from: string; to: string };
  totals: StatementsTotals;
  previous?: {
    range: { from: string; to: string };
    totals: StatementsTotals;
    growthPct: number | null;
  };
  byField: {
    fieldCode: string;
    revenuePaise: number;
    collectionsPaise: number;
    outstandingPaise: number;
    profitPaise: number | null;
  }[];
  costTrackingNote: string;
}

async function computeStatementsTotals(
  dateFrom: string,
  dateTo: string,
  fieldId?: string
): Promise<StatementsTotals> {
  const customerRows = await loadCustomers(fieldId);
  const saleRows = (await loadSalesByCustomerIds(customerRows.map((c) => c.id))).filter(
    (s) => s.saleDate >= dateFrom && s.saleDate <= dateTo
  );
  const revenuePaise = sumBy(saleRows, (s) => s.finalAmountPaise);
  const discountsPaise = sumBy(saleRows, (s) => s.discountPaise);

  const ledgerRows = await loadLedgerByCustomerIds(
    customerRows.map((c) => c.id),
    { dateFrom, dateTo }
  );
  const collectionsPaise = sumBy(
    ledgerRows.filter((e) => e.type === LedgerEntryType.Collection),
    (e) => e.creditPaise
  );

  const allSales = await loadSalesByCustomerIds(customerRows.map((c) => c.id));
  const outstandingEndPaise = sumBy(allSales, (s) => s.balancePaise);

  const productRows = await db.select().from(products);
  const anyCostKnown = productRows.some((p) => p.costPricePaise !== null);
  let cogsPaise: number | null = null;
  if (anyCostKnown && saleRows.length > 0) {
    const costByProductId = new Map(productRows.map((p) => [p.id, p.costPricePaise]));
    const itemRows = await db
      .select()
      .from(saleItems)
      .where(
        inArray(
          saleItems.saleId,
          saleRows.map((s) => s.id)
        )
      );
    cogsPaise = 0;
    for (const item of itemRows) {
      const cost = costByProductId.get(item.productId);
      if (cost !== null && cost !== undefined) cogsPaise += cost * item.quantity;
    }
  }
  const grossProfitPaise = cogsPaise !== null ? revenuePaise - cogsPaise : null;

  return {
    revenuePaise,
    cogsPaise,
    grossProfitPaise,
    discountsPaise,
    collectionsPaise,
    outstandingEndPaise
  };
}

export async function getStatementsReport(
  params: StatementsReportParams
): Promise<StatementsReport> {
  const dateFrom = params.dateFrom ?? monthStartIso();
  const dateTo = params.dateTo ?? todayIso();

  const totals = await computeStatementsTotals(dateFrom, dateTo, params.fieldId);

  const fieldRows = await loadFields();
  const byField = await Promise.all(
    fieldRows.map(async (f) => {
      const t = await computeStatementsTotals(dateFrom, dateTo, f.id);
      return {
        fieldCode: f.code,
        revenuePaise: t.revenuePaise,
        collectionsPaise: t.collectionsPaise,
        outstandingPaise: t.outstandingEndPaise,
        profitPaise: t.grossProfitPaise
      };
    })
  );
  byField.sort((a, b) => b.revenuePaise - a.revenuePaise);

  const result: StatementsReport = {
    range: { from: dateFrom, to: dateTo },
    totals,
    byField,
    costTrackingNote:
      totals.cogsPaise === null
        ? "No product has a cost price on file yet, so gross profit can't be computed — add cost prices in Inventory to unlock profit reporting. Operating expenses (rent, salaries, etc.) aren't tracked in this system, so this is gross profit, not net profit."
        : "Gross profit = revenue − cost of goods sold, for products with a cost price on file. Operating expenses (rent, salaries, etc.) aren't tracked in this system, so this is gross profit, not net profit."
  };

  if (params.compare) {
    const prev = previousPeriod(dateFrom, dateTo);
    const prevTotals = await computeStatementsTotals(prev.from, prev.to, params.fieldId);
    result.previous = {
      range: prev,
      totals: prevTotals,
      growthPct: pctChange(totals.revenuePaise, prevTotals.revenuePaise)
    };
  }

  return result;
}

// ---------------------------------------------------------------------------
// Support lookups for UI filter dropdowns
// ---------------------------------------------------------------------------

export async function listCollectors(): Promise<{ id: string; name: string }[]> {
  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.role, Role.Collector));
  return rows;
}

export async function listProductTypes(): Promise<string[]> {
  const rows = await db.selectDistinct({ type: products.type }).from(products);
  return rows.map((r) => r.type).sort();
}
