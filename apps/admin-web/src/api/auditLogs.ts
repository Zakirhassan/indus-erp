import { api, buildQuery } from "../lib/apiClient";
import type { Page } from "./products";

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  method: string;
  path: string;
  statusCode: number;
  requestBody: string | null;
  responseBody: string | null;
  createdAt: string;
}

export interface ListAuditLogsParams {
  actorId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export async function listAuditLogs(params: ListAuditLogsParams = {}): Promise<Page<AuditLogEntry>> {
  return api.get<Page<AuditLogEntry>>(`/api/audit-logs${buildQuery(params)}`);
}
