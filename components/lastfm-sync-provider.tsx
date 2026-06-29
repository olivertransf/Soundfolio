"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/components/auth-provider";
import { useOptionalStreams } from "@/components/streams-provider";
import { runLastFmSync, type SyncOutcome } from "@/lib/sync/run-lastfm-sync";
import { computeLatestPlayAt } from "@/lib/stats-compute";

type SyncUIState =
  | { phase: "idle" }
  | { phase: "running"; message: string; saved: number; pending: number }
  | { phase: "done"; outcome: SyncOutcome; at: number };

type LastFmSyncContextValue = {
  loading: boolean;
  label: string;
  outcome: SyncOutcome | null;
  runningMessage: string;
  sync: () => Promise<void>;
  canSync: boolean;
};

const LastFmSyncContext = createContext<LastFmSyncContextValue | null>(null);

export function LastFmSyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const streamsCtx = useOptionalStreams();
  const [uiState, setUiState] = useState<SyncUIState>({ phase: "idle" });

  const latestPlayAt = useMemo(
    () => (streamsCtx ? computeLatestPlayAt(streamsCtx.streams) : null),
    [streamsCtx]
  );

  const loading = uiState.phase === "running";

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

  const sync = useCallback(async () => {
    if (!user || !streamsCtx || loading) return;
    setUiState({ phase: "running", message: "Connecting to Last.fm…", saved: 0, pending: 0 });
    try {
      const working = [...streamsCtx.streams];
      const outcome = await runLastFmSync(user.uid, working, (progress) => {
        setUiState({
          phase: "running",
          message: progress.message,
          saved: progress.importedCount,
          pending: progress.pendingCount ?? 0,
        });
      });
      if (outcome.written > 0) {
        streamsCtx.setStreams(working);
        await streamsCtx.refreshHead();
      }
      setUiState({ phase: "done", outcome, at: Date.now() });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Last.fm sync failed.";
      setUiState({
        phase: "done",
        outcome: { written: 0, message, kind: "failed" },
        at: Date.now(),
      });
    }
  }, [user, streamsCtx, loading]);

  const value = useMemo<LastFmSyncContextValue>(
    () => ({
      loading,
      label,
      outcome: uiState.phase === "done" ? uiState.outcome : null,
      runningMessage: uiState.phase === "running" ? uiState.message : "",
      sync,
      canSync: Boolean(user && streamsCtx && !loading),
    }),
    [loading, label, uiState, sync, user, streamsCtx]
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
