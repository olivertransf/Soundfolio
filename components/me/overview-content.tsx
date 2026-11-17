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
import { ListeningMix, RankBars, quietPoint, withRestPlays } from "@/components/visual/mix-charts";
import { albumCovers, artistCovers, recentCovers, trackCovers } from "@/components/visual/rank-covers";
import { ResultLine, scopeResultLine } from "@/components/visual/result-line";
import { NumberChart, StatGrid, countDetail, extraStatItems, listeningStatItems } from "@/components/visual/stat-grid";
import { useBasePath } from "@/components/visual/use-base-path";
import { useViewerTimeZone } from "@/components/visual/use-viewer-time-zone";
import { historyChartData } from "@/lib/stats-chart-data";
import { albumPath, artistPath, trackPath } from "@/lib/entity-paths";
import {
  calendarDaysInFilter,
  computeInsightSummary,
  computeListeningDiversity,
  computeListeningSpan,
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
  const hours = useMemo(
    () => computeStreamsByHour(deferredStreams, filter, timeZone),
    [deferredStreams, filter, timeZone]
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
  const peakHour = useMemo(
    () => computePeakHour(deferredStreams, filter, timeZone),
    [deferredStreams, filter, timeZone]
  );
  const days = calendarDaysInFilter(filter, span, timeZone);

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

  const peakDay = weekdays.reduce((best, day) => (day.minutes > best.minutes ? day : best));
  const quietHourPoint = quietPoint(hours);
  const topArtist = breakdown.artistShare.find((artist) => artist.label !== "Rest") ?? null;
  const topTenPlays = topTracks.slice(0, 10).reduce((sum, track) => sum + track.streams, 0);
  const replay = breakdown.replays[1];

  return (
    <PageShell className="space-y-6">
      <section className="space-y-4">
        <CoverRail items={albumCovers(topAlbums.slice(0, 5), base)} size="hero" />
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
            peakDay: peakDay.label,
            peakDayDetail: countDetail(peakDay.minutes, peakDay.streams),
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
      </section>

      <NumberChart title="This year" detail={countDetail(stats.totalMinutes, stats.totalStreams)}>
        <BarSeriesChart
          points={year}
          metric="minutes"
          label="Minutes by month"
          onSelect={openMonth}
        />
      </NumberChart>

      <div className="grid gap-3 xl:grid-cols-3">
        <NumberChart title="Tracks" detail={topTracks[0] ? `${topTracks[0].trackName} · ${countDetail(topTracks[0].minutesListened, topTracks[0].streams)}` : undefined}>
          <RankBars
            items={topTracks.slice(0, 8).map((track) => ({
              key: `${track.artistName}-${track.trackName}`,
              label: track.trackName,
              hint: track.artistName,
              minutes: track.minutesListened,
              plays: track.streams,
              href: `${base}${trackPath(track.artistName, track.trackName)}`,
            }))}
          />
        </NumberChart>
        <NumberChart title="Artists" detail={topArtists[0] ? `${topArtists[0].artistName} · ${countDetail(topArtists[0].minutesListened, topArtists[0].streams)}` : undefined}>
          <RankBars
            items={topArtists.slice(0, 8).map((artist) => ({
              key: artist.artistName,
              label: artist.artistName,
              minutes: artist.minutesListened,
              plays: artist.streams,
              href: `${base}${artistPath(artist.artistName)}`,
            }))}
          />
        </NumberChart>
        <NumberChart title="Albums" detail={topAlbums[0] ? `${topAlbums[0].albumName} · ${countDetail(topAlbums[0].minutesListened, topAlbums[0].streams)}` : undefined}>
          <RankBars
            items={topAlbums.slice(0, 8).map((album) => ({
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

      <CoverRail title="Tracks" items={trackCovers(topTracks, base)} />
      <CoverRail title="Artists" items={artistCovers(topArtists, base)} shape="round" />
      <CoverRail title="Albums" items={albumCovers(topAlbums, base)} />

      <div className="grid gap-3 lg:grid-cols-2">
        <NumberChart title="Time of day" detail={peakHour ? `${formatHourLabel(peakHour.label)} · ${countDetail(peakHour.minutes, peakHour.streams)}` : undefined}>
          <BarSeriesChart points={hours} metric="minutes" label="Time of day" />
        </NumberChart>
        <NumberChart title="Weekday" detail={`${peakDay.label} · ${countDetail(peakDay.minutes, peakDay.streams)}`}>
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

      <CoverRail title="Recent" items={recentCovers(recent, base)} />
    </PageShell>
  );
}
