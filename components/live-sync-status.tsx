"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Activity, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type FreshnessPayload = {
  latestPlayAt: string | null;
  checkedAt: string;
};

export function LiveSyncStatus() {
  const router = useRouter();
  const [payload, setPayload] = useState<FreshnessPayload | null>(null);
  const [loading, setLoading] = useState(false);

  const loadFreshness = useCallback(async () => {
    const response = await fetch("/api/stats/freshness", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) return;
    setPayload((await response.json()) as FreshnessPayload);
  }, []);

  useEffect(() => {
    void loadFreshness();
  }, [loadFreshness]);

  const label = useMemo(() => {
    if (!payload?.latestPlayAt) return "No plays yet";
    return `Last play · ${formatDistanceToNow(new Date(payload.latestPlayAt), { addSuffix: true })}`;
  }, [payload]);

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => {
        void (async () => {
          setLoading(true);
          try {
            await fetch("/api/sync-lastfm", {
              method: "POST",
              credentials: "same-origin",
            });
            await loadFreshness();
            router.refresh();
          } finally {
            setLoading(false);
          }
        })();
      }}
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
