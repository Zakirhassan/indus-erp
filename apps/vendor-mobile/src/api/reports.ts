import type { CustomerApprovalStatus, Occurrence } from "@indus/shared-types";
import { api, buildQuery } from "../lib/apiClient";

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
  occurrence: Occurrence;
  lastCollectionDate: string | null;
  /** Up to the last 5 completed collection periods before the current (still-open) one, oldest→newest. true = a collection landed in that period. */
  recentPeriods: boolean[];
}

export interface CollectDueReport {
  asOfDate: string;
  dueToday: CollectDueRow[];
  overdue: CollectDueRow[];
}

export async function getCollectDueReport(fieldId: string): Promise<CollectDueReport> {
  return api.get<CollectDueReport>(`/api/reports/collect-due${buildQuery({ fieldId })}`);
}

export interface TodaysAddOnSaleRow {
  customerId: string;
  fieldCode: string;
  serialNo: number;
  name: string;
  approvalStatus: CustomerApprovalStatus;
  amountPaise: number;
}

/** Products this collector added today to an existing customer's sale (see CustomerDetailScreen's "Add Product"). */
export async function getTodaysAddOnSales(asOfDate: string): Promise<TodaysAddOnSaleRow[]> {
  return api.get<TodaysAddOnSaleRow[]>(`/api/reports/today-add-on-sales${buildQuery({ asOfDate })}`);
}
