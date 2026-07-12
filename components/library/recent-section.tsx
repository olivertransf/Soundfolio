"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RecentPlaysPanel } from "@/components/recent-plays-panel";
import { PatternsSidePanel } from "@/components/home-patterns-section";
import { FilterToolbar } from "@/components/filter-toolbar";
import { useStreams } from "@/components/streams-provider";
import {
  computeRecentStreams,
  filterForStats,
  parseTimeRange,
} from "@/lib/stats-compute";
import { VIEWER_TIMEZONE_PARAM } from "@/lib/stats-timezone";
import {
  detectViewerTimeZone,
  readViewerTimeZoneCookie,
} from "@/lib/viewer-timezone-client";

function RecentSectionInner() {
  const searchParams = useSearchParams();
  const { streams, loading } = useStreams();
  const [limitToPeriod, setLimitToPeriod] = useState(false);

  const range = searchParams.get("range") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const viewerTimeZone =
    searchParams.get(VIEWER_TIMEZONE_PARAM) ??
    readViewerTimeZoneCookie() ??
    detectViewerTimeZone();

  const filter = useMemo(
    () => parseTimeRange(range, from, to, viewerTimeZone ?? undefined),
    [range, from, to, viewerTimeZone]
  );

  const recent = useMemo(() => {
    const source = limitToPeriod
      ? filterForStats(streams, filter)
      : streams.filter((s) => !s.isDemo);
    return computeRecentStreams(source, 150);
  }, [streams, filter, limitToPeriod]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <FilterToolbar context="recent" />
        </div>
        <label className="flex min-h-11 shrink-0 items-center gap-2 border border-border bg-card px-3 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={limitToPeriod}
            onChange={(e) => setLimitToPeriod(e.target.checked)}
            className="accent-primary"
          />
          Limit to period
        </label>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <RecentPlaysPanel
          title="Recent"
          streams={recent}
          className="min-h-[28rem] lg:min-h-[calc(100dvh-12rem)]"
        />
        <PatternsSidePanel className="min-h-[20rem] lg:sticky lg:top-[calc(3.5rem+env(safe-area-inset-top,0px))] lg:h-[calc(100dvh-12rem)]" />
      </div>
    </div>
  );
}

export function LibraryRecentSection() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading recent…</p>}>
      <RecentSectionInner />
    </Suspense>
  );
}
