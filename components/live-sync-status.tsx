"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  MinusCircle,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useOptionalStreams } from "@/components/streams-provider";
import { runLastFmSync, type SyncOutcome } from "@/lib/sync/run-lastfm-sync";
import { computeLatestPlayAt } from "@/lib/stats-compute";
import { cn } from "@/lib/utils";

type SyncUIState =
  | { phase: "idle" }
  | { phase: "running"; message: string; saved: number; pending: number }
  | { phase: "done"; outcome: SyncOutcome; at: number };

export function LiveSyncStatus() {
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

  const handleSync = useCallback(async () => {
    if (!user || !streamsCtx) return;
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
      await streamsCtx.reload();
      setUiState({ phase: "done", outcome, at: Date.now() });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Last.fm sync failed.";
      setUiState({
        phase: "done",
        outcome: { written: 0, message, kind: "failed" },
        at: Date.now(),
      });
    }
  }, [user, streamsCtx]);

  if (!streamsCtx) return null;

  const outcome = uiState.phase === "done" ? uiState.outcome : null;

  return (
    <button
      type="button"
      disabled={loading || !user}
      onClick={() => void handleSync()}
      className={cn(
        "hidden h-8 max-w-[min(100vw-2rem,20rem)] items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors sm:inline-flex",
        loading && "border-primary/40 bg-primary/10 text-primary",
        outcome?.kind === "added" &&
          "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        outcome?.kind === "upToDate" &&
          "border-primary/30 bg-primary/5 text-primary",
        outcome?.kind === "failed" &&
          "border-destructive/40 bg-destructive/10 text-destructive",
        outcome?.kind === "skipped" &&
          "border-border/60 bg-secondary/30 text-muted-foreground",
        !loading &&
          !outcome &&
          "border-border/60 bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      )}
      aria-label={loading ? uiState.message : "Sync Last.fm and refresh"}
      title={label}
    >
      <StatusIcon loading={loading} outcome={outcome} />
      <span className="truncate">{label}</span>
    </button>
  );
}

function StatusIcon({
  loading,
  outcome,
}: {
  loading: boolean;
  outcome: SyncOutcome | null;
}) {
  if (loading) {
    return <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />;
  }
  if (outcome?.kind === "added" || outcome?.kind === "upToDate") {
    return <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />;
  }
  if (outcome?.kind === "failed") {
    return <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />;
  }
  if (outcome?.kind === "skipped") {
    return <MinusCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />;
  }
  return <Activity className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />;
}
