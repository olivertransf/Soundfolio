"use client";

import { Suspense, useDeferredValue, useMemo } from "react";
import { PageShell } from "@/components/page-shell";
import { useStreams } from "@/components/streams-provider";
import { CoverRail } from "@/components/visual/cover-rail";
import { albumCovers, artistCovers, recentCovers, trackCovers } from "@/components/visual/rank-covers";
import { ResultLine, scopeResultLine } from "@/components/visual/result-line";
import { useBasePath } from "@/components/visual/use-base-path";
import { useViewerTimeZone } from "@/components/visual/use-viewer-time-zone";
import { WeekHeatmap } from "@/components/visual/week-heatmap";
import {
  computeListeningHeatmap,
  computePeakDay,
  computePeakHour,
  computeRecentStreams,
  computeTopAlbums,
  computeTopArtists,
  computeTopTracks,
  computeTotalStats,
  formatHourLabel,
  parseTimeRange,
} from "@/lib/stats-compute";

const sections = [
  { id: "recent", label: "Recent" },
  { id: "rankings", label: "Rankings" },
  { id: "patterns", label: "Patterns" },
  { id: "insights", label: "Insights" },
] as const;

type LibrarySection = (typeof sections)[number]["id"];

function LibraryContentInner() {
  const base = useBasePath();
  const timeZone = useViewerTimeZone();
  const { streams, loading } = useStreams();
  const deferredStreams = useDeferredValue(streams);
  const filter = useMemo(
    () => parseTimeRange("ytd", undefined, undefined, timeZone),
    [timeZone]
  );
  const stats = useMemo(
    () => computeTotalStats(deferredStreams, filter),
    [deferredStreams, filter]
  );
  const heatmap = useMemo(
    () => computeListeningHeatmap(deferredStreams, filter, timeZone),
    [deferredStreams, filter, timeZone]
  );
  const peakHour = useMemo(
    () => computePeakHour(deferredStreams, filter, timeZone),
    [deferredStreams, filter, timeZone]
  );
  const peakDay = useMemo(
    () => computePeakDay(deferredStreams, filter, timeZone),
    [deferredStreams, filter, timeZone]
  );
  const tracks = useMemo(
    () => computeTopTracks(deferredStreams, 12, filter, "minutes"),
    [deferredStreams, filter]
  );
  const artists = useMemo(
    () => computeTopArtists(deferredStreams, 12, filter, "minutes"),
    [deferredStreams, filter]
  );
  const albums = useMemo(
    () => computeTopAlbums(deferredStreams, 12, filter, "minutes"),
    [deferredStreams, filter]
  );
  const recent = useMemo(
    () => computeRecentStreams(deferredStreams, 18, filter),
    [deferredStreams, filter]
  );

  if (loading && streams.length === 0) {
    return <p className="py-20 text-center text-sm text-muted-foreground">Loading library…</p>;
  }

  if (deferredStreams !== streams && stats.totalStreams === 0) {
    return <p className="py-20 text-center text-sm text-muted-foreground">Loading library…</p>;
  }

  if (stats.totalStreams === 0) {
    return <p className="py-20 text-center text-sm text-muted-foreground">No plays this year.</p>;
  }

  const line = scopeResultLine({
    minutes: stats.totalMinutes,
    scope: "this year",
    when:
      peakDay && peakHour
        ? `mostly ${peakDay.label} at ${formatHourLabel(peakHour.label)}`
        : null,
    leader: artists[0]?.artistName,
  });

  return (
    <PageShell className="space-y-6">
      <ResultLine>{line}</ResultLine>
      <WeekHeatmap
        grid={heatmap.grid}
        peakDay={peakDay?.label}
        peakHour={peakHour ? formatHourLabel(peakHour.label) : null}
      />
      <CoverRail title="Tracks" items={trackCovers(tracks, base)} />
      <CoverRail title="Artists" items={artistCovers(artists, base)} shape="round" />
      <CoverRail title="Albums" items={albumCovers(albums, base)} />
      <CoverRail title="Recent" items={recentCovers(recent, base)} />
    </PageShell>
  );
}

export function LibraryContent() {
  return (
    <Suspense
      fallback={<p className="py-20 text-center text-sm text-muted-foreground">Loading library…</p>}
    >
      <LibraryContentInner />
    </Suspense>
  );
}

export function librarySectionHref(
  section: LibrarySection,
  searchParams: URLSearchParams,
  demo = false
) {
  const params = new URLSearchParams(searchParams.toString());
  params.set("section", section);
  return `${demo ? "/demo/library" : "/library"}?${params.toString()}`;
}
