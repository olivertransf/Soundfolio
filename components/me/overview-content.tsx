"use client";

import { useDeferredValue, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Music } from "lucide-react";
import { BarSeriesChart, type ChartPoint } from "@/components/bar-series-chart";
import { LiveSyncStatus } from "@/components/live-sync-status";
import { PageShell } from "@/components/page-shell";
import { useStreams } from "@/components/streams-provider";
import { CoverRail } from "@/components/visual/cover-rail";
import { albumCovers, artistCovers, recentCovers, trackCovers } from "@/components/visual/rank-covers";
import { ResultLine, scopeResultLine } from "@/components/visual/result-line";
import { useBasePath } from "@/components/visual/use-base-path";
import { useViewerTimeZone } from "@/components/visual/use-viewer-time-zone";
import { historyChartData } from "@/lib/stats-chart-data";
import {
  computePeriodBreakdown,
  computeRecentStreams,
  computeStreamsByDayOfWeek,
  computeTopAlbums,
  computeTopArtists,
  computeTopTracks,
  computeTotalStats,
  parseTimeRange,
} from "@/lib/stats-compute";

export function OverviewContent() {
  const router = useRouter();
  const base = useBasePath();
  const timeZone = useViewerTimeZone();
  const { streams, loading, error, reload } = useStreams();
  const deferredStreams = useDeferredValue(streams);
  const filter = useMemo(
    () => parseTimeRange("ytd", undefined, undefined, timeZone),
    [timeZone]
  );
  const stats = useMemo(
    () => computeTotalStats(deferredStreams, filter),
    [deferredStreams, filter]
  );
  const topTracks = useMemo(
    () => computeTopTracks(deferredStreams, 12, filter, "minutes"),
    [deferredStreams, filter]
  );
  const topArtists = useMemo(
    () => computeTopArtists(deferredStreams, 12, filter, "minutes"),
    [deferredStreams, filter]
  );
  const topAlbums = useMemo(
    () => computeTopAlbums(deferredStreams, 12, filter, "minutes"),
    [deferredStreams, filter]
  );
  const recent = useMemo(
    () => computeRecentStreams(deferredStreams, 16, filter),
    [deferredStreams, filter]
  );
  const year = useMemo(
    () => historyChartData(deferredStreams, "months", filter, timeZone).slice().reverse(),
    [deferredStreams, filter, timeZone]
  );
  const breakdown = useMemo(
    () => computePeriodBreakdown(deferredStreams, filter, timeZone),
    [deferredStreams, filter, timeZone]
  );
  const weekdays = useMemo(
    () => computeStreamsByDayOfWeek(deferredStreams, filter, timeZone),
    [deferredStreams, filter, timeZone]
  );

  const openMonth = (point: ChartPoint) => {
    if (!/^\d{4}-\d{2}$/.test(point.label)) return;
    router.push(`${base}/time-machine?month=${point.label}`);
  };

  if (loading && streams.length === 0) {
    return <p className="py-20 text-center text-sm text-muted-foreground">Loading your stats…</p>;
  }

  if (error && streams.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <h1 className="text-2xl font-semibold">Could not load your stats</h1>
        <button type="button" className="text-sm font-medium text-primary" onClick={() => void reload()}>
          Try again
        </button>
      </div>
    );
  }

  if (stats.totalStreams === 0) {
    if (loading || deferredStreams !== streams) {
      return <p className="py-20 text-center text-sm text-muted-foreground">Loading your stats…</p>;
    }
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <Music className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-semibold">No plays this year</h1>
        <LiveSyncStatus />
        <Link href="/history/import" className="text-sm font-medium text-primary">
          Import history
        </Link>
      </div>
    );
  }

  const daypart = breakdown.dayparts.reduce((best, part) =>
    part.minutes > best.minutes ? part : best
  );
  const line = scopeResultLine({
    minutes: stats.totalMinutes,
    scope: "this year",
    when: daypart.minutes > 0 ? `mostly in the ${daypart.label.toLowerCase()}` : null,
    leader: topArtists[0]?.artistName,
  });

  return (
    <PageShell className="space-y-6">
      <section className="space-y-4">
        <CoverRail items={albumCovers(topAlbums.slice(0, 5), base)} size="hero" />
        <ResultLine>{line}</ResultLine>
      </section>

      <div className="rounded-xl border border-border bg-card p-3">
        <BarSeriesChart
          points={year}
          metric="minutes"
          label="Minutes by month"
          onSelect={openMonth}
        />
      </div>

      <CoverRail title="Tracks" items={trackCovers(topTracks, base)} />
      <CoverRail title="Artists" items={artistCovers(topArtists, base)} shape="round" />
      <CoverRail title="Albums" items={albumCovers(topAlbums, base)} />

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-3">
          <BarSeriesChart
            points={breakdown.dayparts}
            metric="minutes"
            label="Time of day"
          />
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <BarSeriesChart points={weekdays} metric="minutes" label="Weekday" />
        </div>
      </div>

      <CoverRail title="Recent" items={recentCovers(recent, base)} />
    </PageShell>
  );
}
