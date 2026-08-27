import type { NextFunction, Request, Response } from "express";
import { recordAuditLog } from "@indus/db";

const REDACTED = "[REDACTED]";
const SENSITIVE_KEYS = new Set(["password", "passwordHash", "token", "accessToken", "refreshToken", "tempPassword"]);
const MAX_BODY_CHARS = 4000;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEYS.has(key) ? REDACTED : redact(val, depth + 1);
  }
  return out;
}

function toCappedJson(value: unknown): string | null {
  if (value === undefined) return null;
  const json = JSON.stringify(redact(value));
  if (!json) return null;
  return json.length > MAX_BODY_CHARS ? `${json.slice(0, MAX_BODY_CHARS)}…` : json;
}

/**
 * Records every mutating request (financial app — every action needs a trail). Registered before
 * the routers, so req.user isn't set yet at that point, but the res.on("finish") callback below
 * only runs once the whole chain — including each router's requireAuth — has completed.
 * Captures the response body via res.json rather than diffing DB state: a generic middleware has
 * no route-specific notion of "before," and these handlers already return the resulting entity.
 */
export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }

  let responseBody: unknown;
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    responseBody = body;
    return originalJson(body);
  }) as Response["json"];

  res.on("finish", () => {
    recordAuditLog({
      actorId: req.user?.userId ?? null,
      actorRole: req.user?.role ?? null,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      requestBody: toCappedJson(req.body),
      responseBody: toCappedJson(responseBody),
    }).catch((err) => console.error("[audit] failed to record log entry", err));
  });

  next();
}
