"use client";

import { Suspense, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
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
  computeAlbumDetail,
  computeListeningSpan,
  parseTimeRange,
} from "@/lib/stats-compute";
import { historyChartData } from "@/lib/stats-chart-data";
import { matchesEntity } from "@/lib/entity-normalize";
import { trackPath } from "@/lib/entity-paths";
import { VIEWER_TIMEZONE_PARAM } from "@/lib/stats-timezone";
import {
  detectViewerTimeZone,
  readViewerTimeZoneCookie,
} from "@/lib/viewer-timezone-client";

function AlbumDetailInner() {
  const params = useParams<{ artist: string; name: string }>();
  const searchParams = useSearchParams();
  const { streams, loading } = useStreams();
  const artistName = decodeURIComponent(params.artist);
  const albumName = decodeURIComponent(params.name);
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
    () => computeAlbumDetail(streams, albumName, artistName, filter),
    [streams, albumName, artistName, filter]
  );
  const scoped = useMemo(
    () =>
      streams.filter(
        (row) => matchesEntity(row.albumName, albumName) && matchesEntity(row.artistName, artistName)
      ),
    [streams, albumName, artistName]
  );
  const span = useMemo(() => computeListeningSpan(scoped, filter), [scoped, filter]);
  const days = calendarDaysInFilter(filter, span, viewerTimeZone ?? undefined);
  const mode = days > 400 ? "months" : days > 120 ? "weeks" : "days";
  const history = useMemo(
    () => historyChartData(scoped, mode, filter, viewerTimeZone ?? "UTC"),
    [scoped, mode, filter, viewerTimeZone]
  );
  const trackBars = detail.tracks.map((track) => ({
    label: track.trackName,
    minutes: track.minutes,
    streams: track.streams,
  }));

  if (loading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Loading album…</p>;
  }

  return (
    <PageShell width="default">
      <FilterToolbar context="entity" />
      <EntityHero
        eyebrow="Album"
        title={detail.albumName}
        subtitle={detail.artistName}
        artwork={
          <AlbumArt
            src={detail.albumArt}
            alt={detail.albumName}
            width={112}
            height={112}
            className="size-full object-cover"
          />
        }
        figures={[
          { label: "Plays", value: detail.streams.toLocaleString() },
          { label: "Minutes", value: detail.minutesListened.toLocaleString() },
          { label: "Tracks heard", value: detail.tracks.length.toLocaleString() },
          { label: "Share", value: `${detail.share}%`, hint: "of minutes" },
        ]}
      />

      <ChartPanel title="Minutes by track" caption={chartCaption(filter.label, "minutes")}>
        <BarSeriesChart points={trackBars} metric="minutes" label="Minutes by track" />
      </ChartPanel>
      <ChartPanel title={historyChartTitle(mode, "minutes")} caption={chartCaption(filter.label, "minutes")}>
        <BarSeriesChart points={history} metric="minutes" label={historyChartTitle(mode, "minutes")} />
      </ChartPanel>

      <SectionBlock title="Tracks">
        <ContentPanel>
          <RankedEntityList
            columns="two"
            sortBy="minutes"
            items={detail.tracks.map((track) => ({
              key: track.trackName,
              href: trackPath(detail.artistName, track.trackName),
              title: track.trackName,
              subtitle: `${track.streams.toLocaleString()} plays`,
              streams: track.streams,
              minutes: track.minutes,
              leading: (
                <AlbumArt
                  src={detail.albumArt}
                  alt={detail.albumName}
                  width={36}
                  height={36}
                  className="size-9 rounded"
                />
              ),
            }))}
          />
        </ContentPanel>
      </SectionBlock>
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
