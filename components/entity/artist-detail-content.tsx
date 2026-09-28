"use client";

import { Suspense, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArtistArt } from "@/components/artist-art";
import { AlbumArt } from "@/components/album-art";
import {
  BarSeriesChart,
  ChartPanel,
  chartCaption,
  historyChartTitle,
} from "@/components/bar-series-chart";
import { EntityHero } from "@/components/entity/entity-hero";
import { FilterToolbar } from "@/components/filter-toolbar";
import { ContentPanel, PageShell, SectionBlock } from "@/components/page-shell";
import { RankedEntityList } from "@/components/ranked-entity-list";
import { useStreams } from "@/components/streams-provider";
import {
  calendarDaysInFilter,
  computeArtistDetail,
  computeListeningSpan,
  computeStreamsByDayOfWeek,
  parseTimeRange,
  parseTopSortBy,
} from "@/lib/stats-compute";
import { historyChartData } from "@/lib/stats-chart-data";
import { matchesEntity } from "@/lib/entity-normalize";
import { albumPath, trackPath } from "@/lib/entity-paths";
import { VIEWER_TIMEZONE_PARAM } from "@/lib/stats-timezone";
import {
  detectViewerTimeZone,
  readViewerTimeZoneCookie,
} from "@/lib/viewer-timezone-client";

function ArtistDetailInner() {
  const params = useParams<{ name: string }>();
  const searchParams = useSearchParams();
  const { streams, loading } = useStreams();
  const artistName = decodeURIComponent(params.name);
  const sortBy = parseTopSortBy(searchParams.get("sort") ?? undefined);
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
  const detail = useMemo(
    () => computeArtistDetail(streams, artistName, filter, sortBy),
    [streams, artistName, filter, sortBy]
  );
  const scoped = useMemo(
    () => streams.filter((row) => matchesEntity(row.artistName, artistName)),
    [streams, artistName]
  );
  const span = useMemo(() => computeListeningSpan(scoped, filter), [scoped, filter]);
  const days = calendarDaysInFilter(filter, span, viewerTimeZone ?? undefined);
  const mode = days > 400 ? "months" : days > 120 ? "weeks" : "days";
  const history = useMemo(
    () => historyChartData(scoped, mode, filter, viewerTimeZone ?? "UTC"),
    [scoped, mode, filter, viewerTimeZone]
  );
  const weekdays = useMemo(
    () => computeStreamsByDayOfWeek(scoped, filter, viewerTimeZone ?? undefined),
    [scoped, filter, viewerTimeZone]
  );
  const trackBars = detail.topTracks.map((track) => ({
    label: track.trackName,
    minutes: track.minutesListened,
    streams: track.streams,
  }));

  if (loading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Loading artist…</p>;
  }

  return (
    <PageShell width="default">
      <FilterToolbar context="entity" />
      <EntityHero
        eyebrow="Artist"
        title={detail.artistName}
        artwork={<ArtistArt src={detail.artistArt} alt={detail.artistName} width={112} height={112} className="size-full" />}
        figures={[
          { label: "Plays", value: detail.streams.toLocaleString() },
          { label: "Minutes", value: detail.minutesListened.toLocaleString() },
          { label: "Tracks", value: detail.uniqueTracks.toLocaleString() },
          { label: "Albums", value: detail.uniqueAlbums.toLocaleString() },
          { label: "Share", value: `${detail.share}%`, hint: "of minutes" },
        ]}
      />

      <ChartPanel title={historyChartTitle(mode, "minutes")} caption={chartCaption(filter.label, "minutes")}>
        <BarSeriesChart points={history} metric="minutes" label={historyChartTitle(mode, "minutes")} />
      </ChartPanel>
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartPanel title="Minutes by weekday" caption={chartCaption(filter.label, "minutes")}>
          <BarSeriesChart points={weekdays} metric="minutes" label="Minutes by weekday" />
        </ChartPanel>
        <ChartPanel title="Minutes by track" caption={chartCaption(filter.label, "minutes")}>
          <BarSeriesChart points={trackBars} metric="minutes" label="Top tracks by minutes" />
        </ChartPanel>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <SectionBlock title="Top tracks">
          <ContentPanel>
            <RankedEntityList
              columns="one"
              sortBy={sortBy}
              items={detail.topTracks.map((track) => ({
                key: track.trackId,
                href: trackPath(track.artistName, track.trackName),
                title: track.trackName,
                subtitle: track.albumName,
                streams: track.streams,
                minutes: track.minutesListened,
                leading: (
                  <AlbumArt
                    src={track.albumArt}
                    alt={track.albumName}
                    width={36}
                    height={36}
                    className="size-9 rounded"
                  />
                ),
              }))}
            />
          </ContentPanel>
        </SectionBlock>

        <SectionBlock title="Top albums">
          <ContentPanel>
            <RankedEntityList
              columns="one"
              sortBy={sortBy}
              items={detail.topAlbums.map((album) => ({
                key: `${album.albumName}-${album.artistName}`,
                href: albumPath(album.artistName, album.albumName),
                title: album.albumName,
                subtitle: album.artistName,
                streams: album.streams,
                minutes: album.minutesListened,
                leading: (
                  <AlbumArt
                    src={album.albumArt}
                    alt={album.albumName}
                    width={36}
                    height={36}
                    className="size-9 rounded"
                  />
                ),
              }))}
            />
          </ContentPanel>
        </SectionBlock>
      </div>
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
