"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/components/auth-provider";
import { useOptionalStreams } from "@/components/streams-provider";
import { runLastFmSync, type SyncOutcome } from "@/lib/sync/run-lastfm-sync";
import { computeLatestPlayAt } from "@/lib/stats-compute";
import {
  AUTO_SYNC_EVENT,
  AUTO_SYNC_STALE_MS,
  loadAutoSyncEnabled,
  readLastSyncAt,
  writeLastSyncAt,
} from "@/lib/auto-lastfm-sync";

type SyncUIState =
  | { phase: "idle" }
  | { phase: "running"; message: string; saved: number; pending: number; total: number }
  | { phase: "done"; outcome: SyncOutcome; at: number };

type LastFmSyncContextValue = {
  loading: boolean;
  label: string;
  outcome: SyncOutcome | null;
  runningMessage: string;
  progress: number | null;
  sync: () => Promise<void>;
  canSync: boolean;
};

const LastFmSyncContext = createContext<LastFmSyncContextValue | null>(null);

export function LastFmSyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const streamsCtx = useOptionalStreams();
  const [uiState, setUiState] = useState<SyncUIState>({ phase: "idle" });
  const autoStarted = useRef(false);
  const syncingRef = useRef(false);

  const latestPlayAt = useMemo(
    () => (streamsCtx ? computeLatestPlayAt(streamsCtx.streams) : null),
    [streamsCtx]
  );

  const loading = uiState.phase === "running";
  const progress =
    uiState.phase === "running" && uiState.total > 0
      ? Math.min(100, Math.round((uiState.saved / uiState.total) * 100))
      : null;

  useEffect(() => {
    if (uiState.phase !== "done") return;
    const timer = window.setTimeout(() => {
      setUiState({ phase: "idle" });
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [uiState]);

  const label = useMemo(() => {
    if (uiState.phase === "running") {
      if (uiState.saved > 0) {
        return uiState.pending > 0
          ? `Saved ${uiState.saved} · ${uiState.pending} left`
          : `Saved ${uiState.saved}`;
      }
      return uiState.message;
    }
    if (uiState.phase === "done") return uiState.outcome.message;
    if (!latestPlayAt) return "Sync Last.fm";
    return `Synced ${formatDistanceToNow(latestPlayAt, { addSuffix: true })}`;
  }, [latestPlayAt, uiState]);

  const devSync = process.env.NODE_ENV === "development";

  const sync = useCallback(async () => {
    if ((!user && !devSync) || !streamsCtx || syncingRef.current) return;
    syncingRef.current = true;
    setUiState({ phase: "running", message: "Connecting to Last.fm…", saved: 0, pending: 0, total: 0 });
    try {
      const working = [...streamsCtx.streams];
      const outcome = await runLastFmSync(user?.uid ?? "dev", working, (update) => {
        setUiState({
          phase: "running",
          message: update.message,
          saved: update.importedCount,
          pending: update.pendingCount ?? 0,
          total: update.totalNovel ?? 0,
        });
      });
      if (outcome.written > 0) {
        streamsCtx.setStreams(working);
        if (user) await streamsCtx.refreshHead();
      }
      if (outcome.kind === "added" || outcome.kind === "upToDate") {
        writeLastSyncAt();
      }
      setUiState({ phase: "done", outcome, at: Date.now() });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Last.fm sync failed.";
      setUiState({
        phase: "done",
        outcome: { written: 0, message, kind: "failed" },
        at: Date.now(),
      });
    } finally {
      syncingRef.current = false;
    }
  }, [user, devSync, streamsCtx]);

  useEffect(() => {
    if (autoStarted.current) return;
    if ((!user && !devSync) || !streamsCtx?.fullyLoaded) return;
    if (!loadAutoSyncEnabled()) return;
    const last = readLastSyncAt();
    if (last > 0 && Date.now() - last < AUTO_SYNC_STALE_MS) return;
    autoStarted.current = true;
    void sync();
  }, [user, devSync, streamsCtx?.fullyLoaded, sync]);

  useEffect(() => {
    const onChange = () => {
      if (!loadAutoSyncEnabled()) autoStarted.current = true;
    };
    window.addEventListener(AUTO_SYNC_EVENT, onChange);
    return () => window.removeEventListener(AUTO_SYNC_EVENT, onChange);
  }, []);

  const value = useMemo<LastFmSyncContextValue>(
    () => ({
      loading,
      label,
      outcome: uiState.phase === "done" ? uiState.outcome : null,
      runningMessage: uiState.phase === "running" ? uiState.message : "",
      progress,
      sync,
      canSync: Boolean((user || devSync) && streamsCtx && !loading),
    }),
    [loading, label, uiState, progress, sync, user, devSync, streamsCtx]
  );

  return <LastFmSyncContext.Provider value={value}>{children}</LastFmSyncContext.Provider>;
}

export function useLastFmSync() {
  const ctx = useContext(LastFmSyncContext);
  if (!ctx) {
    throw new Error("useLastFmSync must be used within LastFmSyncProvider");
  }
  return ctx;
}

export function useOptionalLastFmSync() {
  return useContext(LastFmSyncContext);
}
