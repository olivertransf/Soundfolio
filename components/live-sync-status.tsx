"use client";

import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  MinusCircle,
  RefreshCw,
} from "lucide-react";
import { useOptionalLastFmSync } from "@/hooks/use-lastfm-sync";
import { useOptionalStreams } from "@/components/streams-provider";
import type { SyncOutcome } from "@/lib/sync/run-lastfm-sync";
import { cn } from "@/lib/utils";

type LiveSyncStatusProps = {
  className?: string;
  fullWidth?: boolean;
};

export function LiveSyncStatus({ className, fullWidth = false }: LiveSyncStatusProps) {
  const streamsCtx = useOptionalStreams();
  const syncCtx = useOptionalLastFmSync();

  if (!streamsCtx || !syncCtx) return null;

  const { loading, label, outcome, runningMessage, sync, canSync } = syncCtx;

  return (
    <button
      type="button"
      disabled={!canSync}
      onClick={() => void sync()}
      className={cn(
        "inline-flex h-8 max-w-[min(100vw-2rem,20rem)] items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors",
        fullWidth && "w-full max-w-none justify-center",
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
          "border-border/60 bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
        className
      )}
      aria-label={loading ? runningMessage : "Sync Last.fm and refresh"}
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
