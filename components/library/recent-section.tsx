"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { RecentPlaysList } from "@/components/recent-plays-list";
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
    <div className="space-y-4">
      <FilterToolbar context="recent" />
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={limitToPeriod}
          onChange={(e) => setLimitToPeriod(e.target.checked)}
          className="rounded border-border"
        />
        Limit to selected period
      </label>
      <Card className="border-border/50 bg-card/70">
        <CardContent className="p-3 sm:p-4">
          <RecentPlaysList
            linkable
            initialStreams={recent.map((stream) => ({
              id: stream.id,
              trackName: stream.trackName,
              artistName: stream.artistName,
              albumName: stream.albumName,
              albumArt: stream.albumArt,
              playedAt: stream.playedAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>
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
