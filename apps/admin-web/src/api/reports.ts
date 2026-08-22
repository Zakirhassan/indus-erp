import { api, buildQuery } from "../lib/apiClient";

// Types mirror packages/db/src/queries/reports.ts response shapes (not imported
// directly — the browser bundle never references the server-only @indus/db package).

export interface DateRangeParams {
  dateFrom?: string;
  dateTo?: string;
  fieldId?: string;
}

export interface ReportsOverview {
  asOfDate: string;
  totals: {
    totalCustomers: number;
    activeCustomers: number;
    inactiveCustomers: number;
    newCustomersMtd: number;
    completedCustomers: number;
    returnedCustomers: number;
    totalSalesMtdPaise: number;
    totalSalesYtdPaise: number;
    cashSalesMtdPaise: number;
    financeSalesMtdPaise: number;
    totalCollectionsMtdPaise: number;
    totalOutstandingPaise: number;
    totalInventoryValuePaise: number;
    grossProfitMtdPaise: number | null;
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
  businessHealthScore: number;
}

export async function getReportsOverview(asOfDate?: string): Promise<ReportsOverview> {
  return api.get<ReportsOverview>(`/api/reports/overview${buildQuery({ asOfDate })}`);
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

export interface SalesReportParams extends DateRangeParams {
  productType?: string;
  compare?: boolean;
}

export async function getSalesReport(params: SalesReportParams): Promise<SalesReport> {
  return api.get<SalesReport>(
    `/api/reports/sales${buildQuery({ ...params, compare: params.compare ? "true" : undefined })}`
  );
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

export interface CollectionsReportParams extends DateRangeParams {
  collectorId?: string;
}

export async function getCollectionsReport(
  params: CollectionsReportParams
): Promise<CollectionsReport> {
  return api.get<CollectionsReport>(`/api/reports/collections${buildQuery(params)}`);
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

export async function getOutstandingReport(params: {
  fieldId?: string;
  asOfDate?: string;
}): Promise<OutstandingReport> {
  return api.get<OutstandingReport>(`/api/reports/outstanding${buildQuery(params)}`);
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
  attentionList: AttentionCustomer[];
  nonPerformingList: AttentionCustomer[];
}

export async function getCustomersReport(params: DateRangeParams): Promise<CustomersReport> {
  return api.get<CustomersReport>(`/api/reports/customers${buildQuery(params)}`);
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

export async function getCollectDueReport(params: {
  fieldId?: string;
  asOfDate?: string;
}): Promise<CollectDueReport> {
  return api.get<CollectDueReport>(`/api/reports/collect-due${buildQuery(params)}`);
}

export interface FinanceReport {
  range: { from: string; to: string };
  totals: {
    totalFinancedPaise: number;
    totalAdvancePaise: number;
    activeFinanceCount: number;
    completedFinanceCount: number;
    totalOutstandingPaise: number;
    recoveryRatePct: number;
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

export async function getFinanceReport(params: DateRangeParams): Promise<FinanceReport> {
  return api.get<FinanceReport>(`/api/reports/finance${buildQuery(params)}`);
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

export async function getInventoryReport(params: { type?: string } = {}): Promise<InventoryReport> {
  return api.get<InventoryReport>(`/api/reports/inventory${buildQuery(params)}`);
}

export interface ReturnsReport {
  range: { from: string; to: string };
  totals: { count: number; advanceRefundedPaise: number; returnRatePct: number };
  byDay: { date: string; count: number }[];
  byField: { fieldCode: string; count: number; advanceRefundedPaise: number }[];
  byProduct: { productId: string; name: string; count: number }[];
  byReason: { reason: string; count: number }[];
}

export interface ReturnsReportParams extends DateRangeParams {
  productId?: string;
}

export async function getReturnsReport(params: ReturnsReportParams): Promise<ReturnsReport> {
  return api.get<ReturnsReport>(`/api/reports/returns${buildQuery(params)}`);
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

export interface StatementsReportParams extends DateRangeParams {
  compare?: boolean;
}

export async function getStatementsReport(
  params: StatementsReportParams
): Promise<StatementsReport> {
  return api.get<StatementsReport>(
    `/api/reports/statements${buildQuery({ ...params, compare: params.compare ? "true" : undefined })}`
  );
}

export async function listReportCollectors(): Promise<{ id: string; name: string }[]> {
  return api.get<{ id: string; name: string }[]>("/api/reports/meta/collectors");
}

export async function listReportProductTypes(): Promise<string[]> {
  return api.get<string[]>("/api/reports/meta/product-types");
}
