"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { useSearchParams } from "next/navigation";
import { Music } from "lucide-react";
import { TopSortTabs } from "@/components/top-sort-tabs";
import { OverviewMetricsGrid } from "@/components/overview-metrics-grid";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ListeningActivity } from "@/components/listening-activity";
import { HomePatternsSection } from "@/components/home-patterns-section";
import { RecentPlaysList } from "@/components/recent-plays-list";
import { AlbumArt } from "@/components/album-art";
import { ArtistArt } from "@/components/artist-art";
import { useStreams } from "@/components/streams-provider";
import {
  calendarDaysInFilter,
  computeLatestPlayAt,
  computeListeningDiversity,
  computeListeningSpan,
  computeRecentStreams,
  computeTopAlbums,
  computeTopArtists,
  computeTopTracks,
  computeTotalStats,
  parseTimeRange,
  parseTopSortBy,
} from "@/lib/stats-compute";
import { VIEWER_TIMEZONE_PARAM } from "@/lib/stats-timezone";
import {
  detectViewerTimeZone,
  readViewerTimeZoneCookie,
} from "@/lib/viewer-timezone-client";

export function OverviewContent() {
  const searchParams = useSearchParams();
  const { streams, loading } = useStreams();

  const range = searchParams.get("range") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const viewerTimeZone =
    searchParams.get(VIEWER_TIMEZONE_PARAM) ??
    (typeof window !== "undefined" ? readViewerTimeZoneCookie() : null) ??
    detectViewerTimeZone();
  const sortBy = parseTopSortBy(searchParams.get("sort") ?? undefined);

  const filter = useMemo(
    () => parseTimeRange(range, from, to, viewerTimeZone ?? undefined),
    [range, from, to, viewerTimeZone]
  );

  const stats = useMemo(() => computeTotalStats(streams, filter), [streams, filter]);
  const topTracks = useMemo(() => computeTopTracks(streams, 5, filter, sortBy), [streams, filter, sortBy]);
  const topArtists = useMemo(() => computeTopArtists(streams, 5, filter, sortBy), [streams, filter, sortBy]);
  const topAlbums = useMemo(() => computeTopAlbums(streams, 5, filter, sortBy), [streams, filter, sortBy]);
  const latestPlayAt = useMemo(() => computeLatestPlayAt(streams), [streams]);
  const diversity = useMemo(() => computeListeningDiversity(streams, filter), [streams, filter]);
  const span = useMemo(() => computeListeningSpan(streams, filter), [streams, filter]);
  const recentStreams = useMemo(() => computeRecentStreams(streams, 7), [streams]);

  const days = calendarDaysInFilter(filter, span, viewerTimeZone ?? undefined);
  const avgMinPerDay = Math.round(stats.totalMinutes / days);
  const avgStreamsPerDay = Math.round(stats.totalStreams / days);
  const hasData = stats.totalStreams > 0;

  const metrics = [
    { label: "Minutes", value: stats.totalMinutes.toLocaleString(), hint: `${stats.totalHours.toLocaleString()} h` },
    { label: "Streams", value: stats.totalStreams.toLocaleString() },
    { label: "Tracks", value: diversity.uniqueTracks.toLocaleString(), hint: "unique" },
    { label: "Artists", value: diversity.uniqueArtists.toLocaleString(), hint: "unique" },
    { label: "Min / day", value: avgMinPerDay.toLocaleString(), hint: `~${days} d` },
    { label: "Plays / day", value: avgStreamsPerDay.toLocaleString() },
  ];

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Loading your stats…
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Music className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">No data yet</h1>
        <p className="max-w-sm text-muted-foreground">
          Sync Last.fm or import your listening history to see stats here.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 sm:space-y-5">
      <section className="overflow-hidden rounded-3xl border border-border/50 bg-card/55 p-5 shadow-2xl ring-1 ring-border/30 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full border border-primary/20 bg-primary/10 text-primary">
                {filter.label}
              </Badge>
              <Badge variant="outline" className="rounded-full border-border/60 text-muted-foreground">
                Live stats
              </Badge>
            </div>
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">
                Your listening, tuned live.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Explore the shape of your listening history with live refresh,
                richer charts, and controls that stay out of your way.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link href="#listening" className="rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90">
                View chart
              </Link>
              <Link href="#patterns" className="rounded-full border border-border/60 bg-secondary/30 px-4 py-2 font-medium text-foreground hover:bg-secondary/50">
                View patterns
              </Link>
            </div>
          </div>
          <div className="grid gap-2 rounded-2xl border border-border/50 bg-background/45 p-4 text-sm sm:min-w-64">
            <div className="flex items-center justify-between gap-6">
              <span className="text-muted-foreground">Last play</span>
              <span className="font-medium tabular-nums text-foreground">
                {latestPlayAt ? formatDistanceToNow(latestPlayAt, { addSuffix: true }) : "No plays"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="text-muted-foreground">Average</span>
              <span className="font-medium tabular-nums text-foreground">
                {avgMinPerDay.toLocaleString()} min / day
              </span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="text-muted-foreground">Library</span>
              <span className="font-medium tabular-nums text-foreground">
                {diversity.uniqueTracks.toLocaleString()} tracks
              </span>
            </div>
          </div>
        </div>
      </section>

      <OverviewMetricsGrid metrics={metrics} />

      <div id="listening" className="grid scroll-mt-24 gap-4 lg:grid-cols-[minmax(0,1fr)_min(100%,15.5rem)] lg:items-stretch xl:grid-cols-[minmax(0,1fr)_min(100%,17.5rem)] xl:gap-5">
        <Suspense
          fallback={
            <Card className="rounded-2xl border border-border/40 bg-card/40 shadow-none ring-0">
              <CardContent className="flex h-[240px] items-center justify-center px-4 text-sm leading-relaxed text-muted-foreground">
                Loading chart…
              </CardContent>
            </Card>
          }
        >
          <ListeningActivity periodLabel={filter.label} compact />
        </Suspense>

        <aside className="min-w-0 lg:sticky lg:top-[calc(4.25rem+env(safe-area-inset-top,0px))] lg:self-stretch">
          <div className="flex h-full min-h-0 flex-col rounded-2xl border border-border/40 bg-border/15 p-px">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[15px] bg-card/80">
              <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Recent
                </h2>
                <Link href="/history/recent" className="text-xs font-medium text-primary hover:underline">
                  View all
                </Link>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-1">
                <RecentPlaysList
                  compact
                  initialStreams={recentStreams.map((stream) => ({
                    id: stream.id,
                    trackName: stream.trackName,
                    artistName: stream.artistName,
                    albumName: stream.albumName,
                    albumArt: stream.albumArt,
                    playedAt: stream.playedAt.toISOString(),
                  }))}
                />
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-sm text-muted-foreground">Top rankings for {filter.label.toLowerCase()}</p>
        <div className="w-full min-w-0 space-y-1.5 sm:max-w-[11rem]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Rank by</p>
          <Suspense>
            <TopSortTabs />
          </Suspense>
        </div>
      </div>

      <div className="rounded-2xl border border-border/40 bg-border/15 p-px">
        <div className="overflow-hidden rounded-[15px] bg-card/80">
          <div className="grid divide-y divide-border/30 md:grid-cols-3 md:divide-x md:divide-y-0">
            <TopSection title="Top tracks" items={topTracks} sortBy={sortBy} kind="tracks" />
            <TopSection title="Top artists" items={topArtists} sortBy={sortBy} kind="artists" />
            <TopSection title="Top albums" items={topAlbums} sortBy={sortBy} kind="albums" />
          </div>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="rounded-2xl border border-border/40 bg-card/40 px-4 py-8 text-center text-sm leading-relaxed text-muted-foreground">
            Loading patterns…
          </div>
        }
      >
        <HomePatternsSection periodLabel={filter.label} />
      </Suspense>
    </div>
  );
}

function TopSection({
  title,
  items,
  sortBy,
  kind,
}: {
  title: string;
  items: Array<Record<string, unknown>>;
  sortBy: "streams" | "minutes";
  kind: "tracks" | "artists" | "albums";
}) {
  return (
    <section className="min-w-0 p-4">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <ul className="space-y-0">
        {items.map((item, i) => (
          <li key={`${kind}-${i}`}>
            <div className="flex items-center gap-3 rounded-lg py-2 transition-colors hover:bg-muted/20">
              <span className="w-5 shrink-0 text-center text-xs font-medium tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              {kind === "artists" ? (
                <ArtistArt
                  src={item.artistArt as string | null}
                  alt={item.artistName as string}
                  width={32}
                  height={32}
                  className="ring-1 ring-border/25"
                />
              ) : (
                <AlbumArt
                  src={item.albumArt as string | null}
                  alt={(item.albumName as string) ?? (item.trackName as string)}
                  width={32}
                  height={32}
                  className="size-8 shrink-0 rounded-md ring-1 ring-border/25"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-snug">
                  {kind === "albums" ? (item.albumName as string) : kind === "artists" ? (item.artistName as string) : (item.trackName as string)}
                </p>
                <p className="truncate text-xs leading-snug text-muted-foreground">
                  {kind === "tracks" ? (item.artistName as string) : kind === "albums" ? (item.artistName as string) : sortBy === "streams" ? `${(item.minutesListened as number).toLocaleString()} min` : `${(item.streams as number).toLocaleString()} plays`}
                </p>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {sortBy === "streams"
                  ? `${(item.streams as number).toLocaleString()}×`
                  : `${(item.minutesListened as number).toLocaleString()} min`}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
