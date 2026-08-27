import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import NetInfo from "@react-native-community/netinfo";
import { isNetworkError } from "../lib/apiClient";
import { saveDraftBatch, type SaveBatchInput } from "../api/collections";
import { loadQueue, saveQueue, type QueuedBatchSubmission } from "./storage";

interface OfflineQueueContextValue {
  /** Number of collection batches saved locally, waiting to reach the server. */
  pendingCount: number;
  isOnline: boolean;
  syncing: boolean;
  /**
   * Saves a batch as a draft. If the server can't be reached, it's queued locally
   * instead of failing the collector's entry — it's synced automatically once
   * connectivity returns. Returns true if it queued instead of saving live.
   */
  saveOrQueue: (input: SaveBatchInput) => Promise<{ queued: boolean }>;
}

const OfflineQueueContext = createContext<OfflineQueueContextValue | undefined>(undefined);

function genId(): string {
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

export function OfflineQueueProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueuedBatchSubmission[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const loaded = useRef(false);
  const flushing = useRef(false);

  useEffect(() => {
    loadQueue().then((items) => {
      setQueue(items);
      loaded.current = true;
    });
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
    return unsubscribe;
  }, []);

  // Server-side, resubmitting the same date+field+collector batch merges into the existing
  // one and skips serials already recorded (see submitCollectorBatch in packages/db) — so
  // replaying queued batches on reconnect is safe even if a partial submit made it through
  // before the connection dropped.
  async function flush(current: QueuedBatchSubmission[]) {
    if (flushing.current || current.length === 0) return;
    flushing.current = true;
    setSyncing(true);
    let remaining = current;
    try {
      for (const item of current) {
        try {
          await saveDraftBatch(item.input);
          remaining = remaining.filter((q) => q.id !== item.id);
          setQueue(remaining);
          await saveQueue(remaining);
        } catch (err) {
          if (isNetworkError(err)) break; // still offline — stop and retry later
          // A real server-side rejection: drop it rather than retrying forever silently.
          remaining = remaining.filter((q) => q.id !== item.id);
          setQueue(remaining);
          await saveQueue(remaining);
        }
      }
    } finally {
      flushing.current = false;
      setSyncing(false);
    }
  }

  useEffect(() => {
    if (isOnline && loaded.current && queue.length > 0) {
      flush(queue);
    }
    // Intentionally scoped to isOnline only — flush(queue) always reads the latest queue via
    // its argument, so re-running this effect on every queue change would just be redundant.
  }, [isOnline]);

  const value = useMemo<OfflineQueueContextValue>(
    () => ({
      pendingCount: queue.length,
      isOnline,
      syncing,
      async saveOrQueue(input) {
        try {
          await saveDraftBatch(input);
          return { queued: false };
        } catch (err) {
          if (!isNetworkError(err)) throw err;
          const item: QueuedBatchSubmission = { id: genId(), queuedAt: new Date().toISOString(), input };
          const next = [...queue, item];
          setQueue(next);
          await saveQueue(next);
          return { queued: true };
        }
      },
    }),
    [queue, isOnline, syncing],
  );

  return <OfflineQueueContext.Provider value={value}>{children}</OfflineQueueContext.Provider>;
}

export function useOfflineQueue(): OfflineQueueContextValue {
  const ctx = useContext(OfflineQueueContext);
  if (!ctx) throw new Error("useOfflineQueue must be used within OfflineQueueProvider");
  return ctx;
}
