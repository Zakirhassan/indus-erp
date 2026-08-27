import { and, desc, eq, gte, lte, count } from "drizzle-orm";
import { db } from "../client.js";
import { auditLogs, users } from "../schema.js";
import { genId } from "../id.js";
import type { Page } from "./types.js";

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

export interface RecordAuditLogInput {
  actorId: string | null;
  actorRole: string | null;
  method: string;
  path: string;
  statusCode: number;
  requestBody: string | null;
  responseBody: string | null;
}

/** Fire-and-forget insert — called from auditMiddleware after every mutating request finishes. */
export async function recordAuditLog(entry: RecordAuditLogInput): Promise<void> {
  await db.insert(auditLogs).values({
    id: genId("audit"),
    actorId: entry.actorId,
    actorRole: entry.actorRole,
    method: entry.method,
    path: entry.path,
    statusCode: entry.statusCode,
    requestBody: entry.requestBody,
    responseBody: entry.responseBody,
    createdAt: new Date().toISOString(),
  });
}

export interface ListAuditLogsParams {
  actorId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

/** actorName is resolved here via a join rather than looked up on every write, to keep the audit-log insert cheap. */
export async function listAuditLogs(params: ListAuditLogsParams = {}): Promise<Page<AuditLogEntry>> {
  const { actorId, dateFrom, dateTo, page = 1, pageSize = 50 } = params;
  const conditions = [];
  if (actorId) conditions.push(eq(auditLogs.actorId, actorId));
  if (dateFrom) conditions.push(gte(auditLogs.createdAt, dateFrom));
  if (dateTo) conditions.push(lte(auditLogs.createdAt, dateTo));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        actorId: auditLogs.actorId,
        actorName: users.name,
        actorRole: auditLogs.actorRole,
        method: auditLogs.method,
        path: auditLogs.path,
        statusCode: auditLogs.statusCode,
        requestBody: auditLogs.requestBody,
        responseBody: auditLogs.responseBody,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorId, users.id))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(auditLogs).where(where),
  ]);

  return { items: rows, total: totalRows[0]?.value ?? 0 };
}
