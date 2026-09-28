"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
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
import { LocalDateTime } from "@/components/local-datetime";
import { useStreams } from "@/components/streams-provider";
import {
  calendarDaysInFilter,
  computeListeningSpan,
  computeStreamsByHour,
  computeTrackDetail,
  parseTimeRange,
} from "@/lib/stats-compute";
import { historyChartData } from "@/lib/stats-chart-data";
import { matchesEntity } from "@/lib/entity-normalize";
import { albumPath } from "@/lib/entity-paths";
import { VIEWER_TIMEZONE_PARAM } from "@/lib/stats-timezone";
import {
  detectViewerTimeZone,
  readViewerTimeZoneCookie,
} from "@/lib/viewer-timezone-client";

function TrackDetailInner() {
  const params = useParams<{ artist: string; name: string }>();
  const searchParams = useSearchParams();
  const { streams, loading } = useStreams();

  const artistName = decodeURIComponent(params.artist);
  const trackName = decodeURIComponent(params.name);
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
    () => computeTrackDetail(streams, trackName, artistName, filter),
    [streams, trackName, artistName, filter]
  );
  const scoped = useMemo(
    () =>
      streams.filter(
        (row) => matchesEntity(row.trackName, trackName) && matchesEntity(row.artistName, artistName)
      ),
    [streams, trackName, artistName]
  );
  const span = useMemo(() => computeListeningSpan(scoped, filter), [scoped, filter]);
  const days = calendarDaysInFilter(filter, span, viewerTimeZone ?? undefined);
  const mode = days > 400 ? "months" : days > 120 ? "weeks" : "days";
  const history = useMemo(
    () => historyChartData(scoped, mode, filter, viewerTimeZone ?? "UTC"),
    [scoped, mode, filter, viewerTimeZone]
  );
  const hours = useMemo(
    () => computeStreamsByHour(scoped, filter, viewerTimeZone ?? undefined),
    [scoped, filter, viewerTimeZone]
  );

  if (loading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Loading track…</p>;
  }

  return (
    <PageShell width="default">
      <FilterToolbar context="entity" />
      <EntityHero
        eyebrow="Track"
        title={detail.trackName}
        subtitle={
          <span>
            {detail.artistName}
            {detail.albumName ? (
              <>
                {" · "}
                <Link href={albumPath(detail.artistName, detail.albumName)} className="text-primary hover:underline">
                  {detail.albumName}
                </Link>
              </>
            ) : null}
          </span>
        }
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
          {
            label: "First play",
            value: detail.firstPlayedAt ? (
              <LocalDateTime date={detail.firstPlayedAt.toISOString()} pattern="MMM d, yyyy" />
            ) : (
              "—"
            ),
          },
          {
            label: "Last play",
            value: detail.lastPlayedAt ? (
              <LocalDateTime date={detail.lastPlayedAt.toISOString()} pattern="MMM d, yyyy" />
            ) : (
              "—"
            ),
          },
          { label: "Rank", value: detail.rank ? `#${detail.rank}` : "—", hint: "among tracks" },
          { label: "Share", value: `${detail.share}%`, hint: "of minutes" },
        ]}
      />

      <ChartPanel title={historyChartTitle(mode, "streams")} caption={chartCaption(filter.label, "streams")}>
        <BarSeriesChart points={history} metric="streams" label={historyChartTitle(mode, "streams")} />
      </ChartPanel>
      <ChartPanel title="Plays by hour" caption={chartCaption(filter.label, "streams")}>
        <BarSeriesChart points={hours} metric="streams" label="Plays by hour" />
      </ChartPanel>

      {detail.recentPlays.length > 0 ? (
        <SectionBlock title="Recent plays in period">
          <ContentPanel>
            <div className="grid gap-x-4 divide-y divide-border/30 md:grid-cols-2 md:divide-y-0 xl:grid-cols-3">
              {detail.recentPlays.map((play) => (
                <div key={play.id} className="flex items-center justify-between gap-3 px-1 py-2 text-sm">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    <LocalDateTime date={play.playedAt.toISOString()} pattern="MMM d · h:mm a" />
                  </span>
                  <span className="min-w-0 truncate text-xs">{play.albumName}</span>
                </div>
              ))}
            </div>
          </ContentPanel>
        </SectionBlock>
      ) : null}
    </PageShell>
  );
}

export function TrackDetailContent() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-sm text-muted-foreground">Loading track…</p>}>
      <TrackDetailInner />
    </Suspense>
  );
}
