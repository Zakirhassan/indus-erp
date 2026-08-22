import { randomUUID } from "node:crypto";

export function genId(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
