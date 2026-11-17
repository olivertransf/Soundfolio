"use client";

import { Suspense, useMemo } from "react";
import { useParams } from "next/navigation";
import { ArtistArt } from "@/components/artist-art";
import { EntityHero } from "@/components/entity/entity-hero";
import { PageShell } from "@/components/page-shell";
import { useStreams } from "@/components/streams-provider";
import { CoverRail } from "@/components/visual/cover-rail";
import { EntityCharts } from "@/components/visual/entity-charts";
import { albumCovers, trackCovers } from "@/components/visual/rank-covers";
import { ResultLine, scopeResultLine } from "@/components/visual/result-line";
import { useBasePath } from "@/components/visual/use-base-path";
import { useViewerTimeZone } from "@/components/visual/use-viewer-time-zone";
import { historyChartData } from "@/lib/stats-chart-data";
import {
  calendarDaysInFilter,
  computeArtistDetail,
  computeListeningSpan,
  computeStreamsByDayOfWeek,
  computeStreamsByHour,
  parseTimeRange,
} from "@/lib/stats-compute";
import { matchesEntity } from "@/lib/entity-normalize";

function ArtistDetailInner() {
  const params = useParams<{ name: string }>();
  const base = useBasePath();
  const timeZone = useViewerTimeZone();
  const { streams, loading } = useStreams();
  const artistName = decodeURIComponent(params.name);
  const filter = useMemo(() => parseTimeRange("all", undefined, undefined, timeZone), [timeZone]);
  const detail = useMemo(
    () => computeArtistDetail(streams, artistName, filter, "minutes"),
    [streams, artistName, filter]
  );
  const scoped = useMemo(
    () => streams.filter((row) => matchesEntity(row.artistName, artistName)),
    [streams, artistName]
  );
  const span = useMemo(() => computeListeningSpan(scoped, filter), [scoped, filter]);
  const days = calendarDaysInFilter(filter, span, timeZone);
  const mode = days > 400 ? "months" : days > 120 ? "weeks" : "days";
  const history = useMemo(
    () => historyChartData(scoped, mode, filter, timeZone),
    [scoped, mode, filter, timeZone]
  );
  const hours = useMemo(
    () => computeStreamsByHour(scoped, filter, timeZone),
    [scoped, filter, timeZone]
  );
  const weekdays = useMemo(
    () => computeStreamsByDayOfWeek(scoped, filter, timeZone),
    [scoped, filter, timeZone]
  );

  if (loading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Loading artist…</p>;
  }

  const line =
    detail.streams > 0
      ? scopeResultLine({
          minutes: detail.minutesListened,
          scope: `with ${detail.artistName}`,
          when: `${detail.uniqueTracks.toLocaleString()} tracks`,
        })
      : `No plays from ${detail.artistName}.`;

  return (
    <PageShell className="space-y-6">
      <EntityHero
        title={detail.artistName}
        artwork={
          <ArtistArt
            src={detail.artistArt}
            alt={detail.artistName}
            width={176}
            height={176}
            className="size-full"
          />
        }
      >
        <ResultLine>{line}</ResultLine>
      </EntityHero>
      {detail.streams > 0 ? <EntityCharts history={history} hours={hours} weekdays={weekdays} /> : null}
      <CoverRail title="Tracks" items={trackCovers(detail.topTracks, base)} />
      <CoverRail title="Albums" items={albumCovers(detail.topAlbums, base)} />
    </PageShell>
  );
}

export function ArtistDetailContent() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-sm text-muted-foreground">Loading artist…</p>}>
      <ArtistDetailInner />
    </Suspense>
  );
}
