import { Suspense } from "react";
import { TopSortTabs } from "@/components/top-sort-tabs";
import Link from "next/link";
import { Music } from "lucide-react";
import { OverviewMetricsGrid } from "@/components/overview-metrics-grid";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ListeningActivity } from "@/components/listening-activity";
import { HomePatternsSection } from "@/components/home-patterns-section";
import { RecentPlaysList } from "@/components/recent-plays-list";
import {
  getTotalStats,
  getTopTracks,
  getTopArtists,
  getTopAlbums,
  getLatestPlayAt,
  getRecentStreams,
  parseTimeRange,
  parseTopSortBy,
  getListeningDiversity,
  getListeningSpan,
  calendarDaysInFilter,
} from "@/lib/stats";
import { formatDistanceToNow } from "date-fns";
import { AlbumArt } from "@/components/album-art";
import { ArtistArt } from "@/components/artist-art";
import { cookies } from "next/headers";
import { VIEWER_TIMEZONE_COOKIE } from "@/lib/stats-timezone";

export const dynamic = "force-dynamic";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; tz?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const viewerTimeZone = params.tz ?? cookieStore.get(VIEWER_TIMEZONE_COOKIE)?.value;
  const filter = parseTimeRange(params.range, params.from, params.to, viewerTimeZone);
  const sortBy = parseTopSortBy(params.sort);

  const [
    stats,
    topTracks,
    topArtists,
    topAlbums,
    latestPlayAt,
    diversity,
    span,
    recentStreams,
  ] = await Promise.all([
    getTotalStats(filter),
    getTopTracks(5, filter, "me", sortBy),
    getTopArtists(5, filter, "me", sortBy),
    getTopAlbums(5, filter, "me", sortBy),
    getLatestPlayAt(),
    getListeningDiversity(filter),
    getListeningSpan(filter),
    getRecentStreams(7),
  ]);

  const days = calendarDaysInFilter(filter, span);
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

  if (!hasData) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Music className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">No data yet</h1>
        <p className="max-w-sm text-muted-foreground">
          Import your Spotify data export to see your full listening history and stats.
        </p>
        <a
          href="/history/import"
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Import data
        </a>
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
                Explore the shape of your Spotify history with live refresh,
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
                <Link
                  href="/history/recent"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  View all
                </Link>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-1">
                <RecentPlaysList
                  compact
                  limit={7}
                  pollMs={20_000}
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
        <p className="text-sm text-muted-foreground">
          Top rankings for {filter.label.toLowerCase()}
        </p>
        <div className="w-full min-w-0 space-y-1.5 sm:max-w-[11rem]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Rank by
          </p>
          <Suspense>
            <TopSortTabs />
          </Suspense>
        </div>
      </div>

      <div className="rounded-2xl border border-border/40 bg-border/15 p-px">
        <div className="overflow-hidden rounded-[15px] bg-card/80">
          <div className="grid divide-y divide-border/30 md:grid-cols-3 md:divide-x md:divide-y-0">
            <section className="min-w-0 p-4">
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Top tracks
              </h2>
              <ul className="space-y-0">
                {topTracks.map((track, i) => (
                  <li key={track.trackId}>
                    <div className="flex items-center gap-3 rounded-lg py-2 transition-colors hover:bg-muted/20">
                      <span className="w-5 shrink-0 text-center text-xs font-medium tabular-nums text-muted-foreground">
                        {i + 1}
                      </span>
                      <AlbumArt
                        src={track.albumArt}
                        alt={track.albumName}
                        width={32}
                        height={32}
                        className="size-8 shrink-0 rounded-md ring-1 ring-border/25"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium leading-snug">{track.trackName}</p>
                        <p className="truncate text-xs leading-snug text-muted-foreground">{track.artistName}</p>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {sortBy === "streams"
                          ? `${track.streams.toLocaleString()}×`
                          : `${track.minutesListened.toLocaleString()} min`}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
            <section className="min-w-0 p-4">
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Top artists
              </h2>
              <ul className="space-y-0">
                {topArtists.map((artist, i) => (
                  <li key={artist.artistName}>
                    <div className="flex items-center gap-3 rounded-lg py-2 transition-colors hover:bg-muted/20">
                      <span className="w-5 shrink-0 text-center text-xs font-medium tabular-nums text-muted-foreground">
                        {i + 1}
                      </span>
                      <ArtistArt
                        src={artist.artistArt}
                        alt={artist.artistName}
                        width={32}
                        height={32}
                        className="ring-1 ring-border/25"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium leading-snug">{artist.artistName}</p>
                        <p className="truncate text-xs leading-snug text-muted-foreground">
                          {sortBy === "streams"
                            ? `${artist.minutesListened.toLocaleString()} min`
                            : `${artist.streams.toLocaleString()} plays`}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {sortBy === "streams"
                          ? `${artist.streams.toLocaleString()}×`
                          : `${artist.minutesListened.toLocaleString()} min`}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
            <section className="min-w-0 p-4">
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Top albums
              </h2>
              <ul className="space-y-0">
                {topAlbums.map((album, i) => (
                  <li key={`${album.albumName}-${album.artistName}`}>
                    <div className="flex items-center gap-3 rounded-lg py-2 transition-colors hover:bg-muted/20">
                      <span className="w-5 shrink-0 text-center text-xs font-medium tabular-nums text-muted-foreground">
                        {i + 1}
                      </span>
                      <AlbumArt
                        src={album.albumArt}
                        alt={album.albumName}
                        width={32}
                        height={32}
                        className="size-8 shrink-0 rounded-md ring-1 ring-border/25"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium leading-snug">{album.albumName}</p>
                        <p className="truncate text-xs leading-snug text-muted-foreground">{album.artistName}</p>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {sortBy === "streams"
                          ? `${album.streams.toLocaleString()}×`
                          : `${album.minutesListened.toLocaleString()} min`}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
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
        <HomePatternsSection filter={filter} viewerTimeZone={viewerTimeZone} />
      </Suspense>
    </div>
  );
}
