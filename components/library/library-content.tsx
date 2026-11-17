"use client";

import { Suspense, useDeferredValue, useMemo } from "react";
import { PageShell } from "@/components/page-shell";
import { BarSeriesChart } from "@/components/bar-series-chart";
import { useStreams } from "@/components/streams-provider";
import { CoverRail } from "@/components/visual/cover-rail";
import { ListeningMix, RankBars, quietPoint, withRestPlays } from "@/components/visual/mix-charts";
import { albumCovers, artistCovers, recentCovers, trackCovers } from "@/components/visual/rank-covers";
import { ResultLine, scopeResultLine } from "@/components/visual/result-line";
import { NumberChart, StatGrid, countDetail, extraStatItems, listeningStatItems } from "@/components/visual/stat-grid";
import { useBasePath } from "@/components/visual/use-base-path";
import { useViewerTimeZone } from "@/components/visual/use-viewer-time-zone";
import { WeekHeatmap } from "@/components/visual/week-heatmap";
import { albumPath, artistPath, trackPath } from "@/lib/entity-paths";
import {
  calendarDaysInFilter,
  computeInsightSummary,
  computeListeningDiversity,
  computeListeningHeatmap,
  computeListeningSpan,
  computePeakDay,
  computePeakHour,
  computePeriodBreakdown,
  computeRecentStreams,
  computeStreamsByDayOfWeek,
  computeStreamsByHour,
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
  const diversity = useMemo(
    () => computeListeningDiversity(deferredStreams, filter),
    [deferredStreams, filter]
  );
  const span = useMemo(
    () => computeListeningSpan(deferredStreams, filter),
    [deferredStreams, filter]
  );
  const summary = useMemo(
    () => computeInsightSummary(deferredStreams, filter, timeZone),
    [deferredStreams, filter, timeZone]
  );
  const breakdown = useMemo(
    () => computePeriodBreakdown(deferredStreams, filter, timeZone),
    [deferredStreams, filter, timeZone]
  );
  const hours = useMemo(
    () => computeStreamsByHour(deferredStreams, filter, timeZone),
    [deferredStreams, filter, timeZone]
  );
  const weekdays = useMemo(
    () => computeStreamsByDayOfWeek(deferredStreams, filter, timeZone),
    [deferredStreams, filter, timeZone]
  );
  const days = calendarDaysInFilter(filter, span, timeZone);

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

  const peakWeekday = weekdays.reduce((best, day) => (day.minutes > best.minutes ? day : best));
  const quietHourPoint = quietPoint(hours);
  const topArtist = breakdown.artistShare.find((artist) => artist.label !== "Rest") ?? null;
  const topTenPlays = tracks.slice(0, 10).reduce((sum, track) => sum + track.streams, 0);
  const replay = breakdown.replays[1];

  return (
    <PageShell className="space-y-6">
      <ResultLine>{line}</ResultLine>
      <StatGrid
        items={listeningStatItems({
          minutes: stats.totalMinutes,
          plays: stats.totalStreams,
          days,
          tracks: diversity.uniqueTracks,
          artists: diversity.uniqueArtists,
          albums: diversity.uniqueAlbums,
          activeDays: breakdown.activeDays,
          peakHour: peakHour ? formatHourLabel(peakHour.label) : null,
          peakHourDetail: peakHour ? countDetail(peakHour.minutes, peakHour.streams) : null,
          peakDay: peakDay?.label,
          peakDayDetail: peakDay ? countDetail(peakDay.minutes, peakDay.streams) : null,
          replayShare: breakdown.replayShare,
          topShare: summary.topTenShare,
          topMinutes: summary.topTenMinutes,
          first: span?.first,
          last: span?.last,
        }).concat(
          extraStatItems({
            minutes: stats.totalMinutes,
            plays: stats.totalStreams,
            tracks: diversity.uniqueTracks,
            artists: diversity.uniqueArtists,
            albums: diversity.uniqueAlbums,
            activeDays: breakdown.activeDays,
            dayparts: breakdown.dayparts,
            weekParts: breakdown.weekParts,
            topArtist,
            restMinutes: summary.restMinutes,
            onceTracks: breakdown.onceTracks,
            replayTracks: breakdown.replayTracks,
            replayMinutes: replay?.minutes,
            replayPlays: replay?.streams,
            longestPlayMinutes: breakdown.longestPlayMinutes,
            busiestDay: summary.mostActiveDay,
            busiestMinutes: summary.mostActiveMinutes,
            busiestPlays: summary.mostActivePlays,
            quietDay: summary.quietDay,
            quietMinutes: summary.quietMinutes,
            quietPlays: summary.quietPlays,
            quietHour: quietHourPoint ? formatHourLabel(quietHourPoint.label) : null,
            quietHourDetail: quietHourPoint
              ? countDetail(quietHourPoint.minutes, quietHourPoint.streams)
              : null,
          })
        )}
      />
      <WeekHeatmap
        grid={heatmap.grid}
        peakDay={
          peakDay
            ? `${peakDay.label} · ${countDetail(peakDay.minutes, peakDay.streams)}`
            : null
        }
        peakHour={
          peakHour
            ? `${formatHourLabel(peakHour.label)} · ${countDetail(peakHour.minutes, peakHour.streams)}`
            : null
        }
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <NumberChart
          title="Time of day"
          detail={peakHour ? `${formatHourLabel(peakHour.label)} · ${countDetail(peakHour.minutes, peakHour.streams)}` : undefined}
        >
          <BarSeriesChart points={hours} metric="minutes" label="Time of day" />
        </NumberChart>
        <NumberChart title="Weekday" detail={`${peakWeekday.label} · ${countDetail(peakWeekday.minutes, peakWeekday.streams)}`}>
          <BarSeriesChart points={weekdays} metric="minutes" label="Weekday" />
        </NumberChart>
      </div>
      <ListeningMix
        dayparts={breakdown.dayparts}
        weekParts={breakdown.weekParts}
        replays={breakdown.replays}
        artists={withRestPlays(breakdown.artistShare, stats.totalStreams)}
        topTen={[
          { label: "Top 10", minutes: summary.topTenMinutes, streams: topTenPlays },
          {
            label: "The rest",
            minutes: summary.restMinutes,
            streams: Math.max(0, stats.totalStreams - topTenPlays),
          },
        ]}
      />
      <div className="grid gap-3 xl:grid-cols-3">
        <NumberChart title="Tracks">
          <RankBars
            items={tracks.slice(0, 8).map((track) => ({
              key: `${track.artistName}-${track.trackName}`,
              label: track.trackName,
              hint: track.artistName,
              minutes: track.minutesListened,
              plays: track.streams,
              href: `${base}${trackPath(track.artistName, track.trackName)}`,
            }))}
          />
        </NumberChart>
        <NumberChart title="Artists">
          <RankBars
            items={artists.slice(0, 8).map((artist) => ({
              key: artist.artistName,
              label: artist.artistName,
              minutes: artist.minutesListened,
              plays: artist.streams,
              href: `${base}${artistPath(artist.artistName)}`,
            }))}
          />
        </NumberChart>
        <NumberChart title="Albums">
          <RankBars
            items={albums.slice(0, 8).map((album) => ({
              key: `${album.artistName}-${album.albumName}`,
              label: album.albumName,
              hint: album.artistName,
              minutes: album.minutesListened,
              plays: album.streams,
              href: `${base}${albumPath(album.artistName, album.albumName)}`,
            }))}
          />
        </NumberChart>
      </div>
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
