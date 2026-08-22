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

/** Submits collection entries from the field. NOT posted to the ledger yet — held pending until an admin approves. */
export async function submitCollectionBatch(input: SaveBatchInput): Promise<SaveBatchResult> {
  return api.post<SaveBatchResult>("/api/collections/submit", input);
}
