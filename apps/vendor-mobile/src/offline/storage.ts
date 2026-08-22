import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SaveBatchInput } from "../api/collections";

export interface QueuedBatchSubmission {
  id: string;
  queuedAt: string;
  input: SaveBatchInput;
}

const KEY = "indus-erp-offline-collection-queue";

export async function loadQueue(): Promise<QueuedBatchSubmission[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as QueuedBatchSubmission[]) : [];
}

export async function saveQueue(items: QueuedBatchSubmission[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}
