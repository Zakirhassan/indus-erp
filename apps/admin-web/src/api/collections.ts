import type { CollectionBatch } from "@indus/shared-types";
import { api, buildQuery } from "../lib/apiClient";
import type { Page } from "./products";

export interface ListBatchesParams {
  fieldId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export async function listCollectionBatches(params: ListBatchesParams = {}): Promise<Page<CollectionBatch>> {
  return api.get<Page<CollectionBatch>>(`/api/collections${buildQuery(params)}`);
}

export async function getBatch(id: string): Promise<CollectionBatch | undefined> {
  return api.get<CollectionBatch>(`/api/collections/${id}`);
}

/** Duplicate-batch guard: look up an existing batch for (date, field) to load instead of creating a new one. */
export async function findBatchForDateField(date: string, fieldId: string): Promise<CollectionBatch | undefined> {
  const batch = await api.get<CollectionBatch | null>(`/api/collections/lookup${buildQuery({ date, fieldId })}`);
  return batch ?? undefined;
}

export interface BatchEntryInput {
  serialNo: number;
  amountPaise: number;
}

export async function validateBatchEntries(
  fieldId: string,
  entries: BatchEntryInput[],
): Promise<{ serialNo: number; amountPaise: number; error: string | null }[]> {
  return api.post(`/api/collections/validate`, { fieldId, entries });
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

export async function saveCollectionBatch(input: SaveBatchInput): Promise<SaveBatchResult> {
  return api.post<SaveBatchResult>("/api/collections", input);
}

export async function deleteCollectionBatch(id: string): Promise<void> {
  await api.delete(`/api/collections/${id}`);
}

/** Batches submitted from the vendor app, awaiting admin review. */
export async function listPendingBatches(): Promise<CollectionBatch[]> {
  return api.get<CollectionBatch[]>("/api/collections/pending");
}

export async function verifyBatch(id: string): Promise<CollectionBatch> {
  return api.post<CollectionBatch>(`/api/collections/${id}/verify`);
}

export async function rejectBatch(id: string): Promise<CollectionBatch> {
  return api.post<CollectionBatch>(`/api/collections/${id}/reject`);
}

/** Approves a pending/verified batch: posts every valid entry to the ledger now. */
export async function approveBatch(id: string): Promise<SaveBatchResult> {
  return api.post<SaveBatchResult>(`/api/collections/${id}/approve`);
}
