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
}

export interface CollectDueReport {
  asOfDate: string;
  dueToday: CollectDueRow[];
  overdue: CollectDueRow[];
}

export async function getCollectDueReport(fieldId: string): Promise<CollectDueReport> {
  return api.get<CollectDueReport>(`/api/reports/collect-due${buildQuery({ fieldId })}`);
}
