"use client";

import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    let cancelled = false;
    let lastSeen: string | null = null;

    async function checkFreshness() {
      try {
        await fetch("/api/sync-lastfm", { method: "POST", credentials: "same-origin" });
        const response = await fetch("/api/stats/freshness", { cache: "no-store", credentials: "same-origin" });
        if (!response.ok) return;
        const next = (await response.json()) as FreshnessPayload;
        if (cancelled) return;
        setPayload(next);
        if (lastSeen && next.latestPlayAt && next.latestPlayAt !== lastSeen) {
          router.refresh();
        }
        lastSeen = next.latestPlayAt;
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    void checkFreshness();
    const interval = window.setInterval(checkFreshness, 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [router]);

  const label = useMemo(() => {
    if (!payload?.latestPlayAt) return "Waiting for plays";
    return `Live · ${formatDistanceToNow(new Date(payload.latestPlayAt), { addSuffix: true })}`;
  }, [payload]);

  return (
    <button
      type="button"
      onClick={() => {
        setLoading(true);
        router.refresh();
      }}
      className={cn(
        "hidden h-8 items-center gap-2 rounded-full border border-border/60 bg-secondary/30 px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground sm:inline-flex",
        loading && "text-primary"
      )}
      aria-label="Refresh dashboard data"
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
