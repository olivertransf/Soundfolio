"use client";

import { Suspense, useMemo } from "react";
import { useParams } from "next/navigation";
import { AlbumArt } from "@/components/album-art";
import { EntityHero } from "@/components/entity/entity-hero";
import { PageShell } from "@/components/page-shell";
import { useStreams } from "@/components/streams-provider";
import { CoverRail } from "@/components/visual/cover-rail";
import { EntityCharts } from "@/components/visual/entity-charts";
import { ResultLine, scopeResultLine } from "@/components/visual/result-line";
import { useBasePath } from "@/components/visual/use-base-path";
import { useViewerTimeZone } from "@/components/visual/use-viewer-time-zone";
import { historyChartData } from "@/lib/stats-chart-data";
import {
  calendarDaysInFilter,
  computeAlbumDetail,
  computeListeningSpan,
  computeStreamsByDayOfWeek,
  computeStreamsByHour,
  parseTimeRange,
} from "@/lib/stats-compute";
import { matchesEntity, sameAlbum } from "@/lib/entity-normalize";
import { trackPath } from "@/lib/entity-paths";

function AlbumDetailInner() {
  const params = useParams<{ artist: string; name: string }>();
  const base = useBasePath();
  const timeZone = useViewerTimeZone();
  const { streams, loading } = useStreams();
  const artistName = decodeURIComponent(params.artist);
  const albumName = decodeURIComponent(params.name);
  const filter = useMemo(() => parseTimeRange("all", undefined, undefined, timeZone), [timeZone]);
  const detail = useMemo(
    () => computeAlbumDetail(streams, albumName, artistName, filter),
    [streams, albumName, artistName, filter]
  );
  const scoped = useMemo(
    () =>
      streams.filter(
        (row) => sameAlbum(row.albumName, albumName) && matchesEntity(row.artistName, artistName)
      ),
    [streams, albumName, artistName]
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
  const tracks = [...detail.tracks].sort((a, b) => b.minutes - a.minutes);

  if (loading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Loading album…</p>;
  }

  const line =
    detail.streams > 0
      ? scopeResultLine({
          minutes: detail.minutesListened,
          scope: `of ${detail.albumName}`,
          when: `${tracks.length.toLocaleString()} tracks`,
        })
      : `No plays of ${detail.albumName}.`;

  return (
    <PageShell className="space-y-6">
      <EntityHero
        title={detail.albumName}
        subtitle={detail.artistName}
        artwork={
          <AlbumArt
            src={detail.albumArt}
            alt={detail.albumName}
            width={176}
            height={176}
            className="size-full object-cover"
          />
        }
      >
        <ResultLine>{line}</ResultLine>
      </EntityHero>
      {detail.streams > 0 ? <EntityCharts history={history} hours={hours} weekdays={weekdays} /> : null}
      <CoverRail
        title="Tracks"
        items={tracks.map((track) => ({
          key: track.trackName,
          href: `${base}${trackPath(detail.artistName, track.trackName)}`,
          title: track.trackName,
          minutes: track.minutes,
          art: (
            <AlbumArt
              src={detail.albumArt}
              alt={detail.albumName}
              width={160}
              height={160}
              className="size-full object-cover"
            />
          ),
        }))}
      />
    </PageShell>
  );
}

export function AlbumDetailContent() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-sm text-muted-foreground">Loading album…</p>}>
      <AlbumDetailInner />
    </Suspense>
  );
}
