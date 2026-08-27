import type { CollectionBatch } from "@indus/shared-types";
import { api, buildQuery } from "../lib/apiClient";

export interface BatchEntryInput {
  serialNo: number;
  amountPaise: number;
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

/** This collector's own in-progress batch for today+field, if one exists (resume instead of duplicating). */
export async function myBatch(date: string, fieldId: string): Promise<CollectionBatch | null> {
  return api.get<CollectionBatch | null>(`/api/collections/mine${buildQuery({ date, fieldId })}`);
}

/** A single batch by id, regardless of owner — used by the read-only Recent Collections history view. */
export async function getBatch(id: string): Promise<CollectionBatch | undefined> {
  return api.get<CollectionBatch>(`/api/collections/${id}`);
}

/** This collector's recent submitted batches across every field — powers the Recent Collections history list. */
export async function recentBatches(limit?: number): Promise<CollectionBatch[]> {
  return api.get<CollectionBatch[]>(`/api/collections/recent${buildQuery({ limit })}`);
}

/** This collector's batches across every field touched on a given day — powers the end-of-day summary on the Dashboard. */
export async function myBatchesToday(date: string): Promise<CollectionBatch[]> {
  return api.get<CollectionBatch[]>(`/api/collections/mine-today${buildQuery({ date })}`);
}

/** Saves collection entries as a draft. Invisible to admin review and no ledger effect until submitDayBatches is called. */
export async function saveDraftBatch(input: SaveBatchInput): Promise<SaveBatchResult> {
  return api.post<SaveBatchResult>("/api/collections/draft", input);
}

/** End-of-day action: promotes every draft batch from today (one per field touched) to pending admin review. */
export async function submitDayBatches(date: string): Promise<CollectionBatch[]> {
  return api.post<CollectionBatch[]>("/api/collections/submit-day", { date });
}

/** Wraps up one field's route: promotes just that field's draft batch to pending admin review. */
export async function submitFieldBatch(date: string, fieldId: string): Promise<CollectionBatch | null> {
  return api.post<CollectionBatch | null>("/api/collections/submit-field", { date, fieldId });
}

/** Day-close gate: this collector's outstanding un-submitted batches from before today, if any. */
export async function getPendingDayClose(): Promise<CollectionBatch[]> {
  return api.get<CollectionBatch[]>("/api/collections/pending-day-close");
}

/** "Submit All & Continue" on the day-close gate — submits every outstanding prior-day batch at once. */
export async function submitPastDrafts(): Promise<CollectionBatch[]> {
  return api.post<CollectionBatch[]>("/api/collections/submit-past");
}
