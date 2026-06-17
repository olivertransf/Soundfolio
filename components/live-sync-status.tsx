"use client";

import { useCallback, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Activity, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useOptionalStreams } from "@/components/streams-provider";
import { runLastFmSync } from "@/lib/sync/run-lastfm-sync";
import {
  computeLatestPlayAt,
} from "@/lib/stats-compute";
import { cn } from "@/lib/utils";

export function LiveSyncStatus() {
  const { user } = useAuth();
  const streamsCtx = useOptionalStreams();
  const [loading, setLoading] = useState(false);

  const latestPlayAt = useMemo(
    () => (streamsCtx ? computeLatestPlayAt(streamsCtx.streams) : null),
    [streamsCtx]
  );

  const label = useMemo(() => {
    if (!latestPlayAt) return "No plays yet";
    return `Last play · ${formatDistanceToNow(latestPlayAt, { addSuffix: true })}`;
  }, [latestPlayAt]);

  const handleSync = useCallback(async () => {
    if (!user || !streamsCtx) return;
    setLoading(true);
    try {
      const working = [...streamsCtx.streams];
      await runLastFmSync(user.uid, working);
      await streamsCtx.reload();
    } catch (error) {
      console.error("[sync]", error);
    } finally {
      setLoading(false);
    }
  }, [user, streamsCtx]);

  if (!streamsCtx) return null;

  return (
    <button
      type="button"
      disabled={loading || !user}
      onClick={() => void handleSync()}
      className={cn(
        "hidden h-8 items-center gap-2 rounded-full border border-border/60 bg-secondary/30 px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground sm:inline-flex",
        loading && "text-primary"
      )}
      aria-label="Sync Last.fm and refresh"
    >
      {loading ? (
        <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <Activity className="h-3.5 w-3.5 text-primary" aria-hidden />
      )}
      <span>{label}</span>
    </button>
  );
}
