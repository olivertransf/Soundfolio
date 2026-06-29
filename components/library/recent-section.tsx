"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RecentPlaysPanel } from "@/components/recent-plays-panel";
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
    const source = limitToPeriod ? filterForStats(streams, filter) : streams.filter((s) => !s.isDemo);
    return computeRecentStreams(source, 100);
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
      <FilterToolbar context="recent" />
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={limitToPeriod}
          onChange={(e) => setLimitToPeriod(e.target.checked)}
          className="rounded border-border"
        />
        Limit to selected period
      </label>
      <RecentPlaysPanel title="Latest listens" streams={recent} />
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
