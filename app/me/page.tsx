import { Suspense } from "react";
import Link from "next/link";
import { Music } from "lucide-react";
import { OverviewMetricsGrid } from "@/components/overview-metrics-grid";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ListeningActivity } from "@/components/listening-activity";
import { HomePatternsSection } from "@/components/home-patterns-section";
import {
  getTotalStats,
  getTopTracks,
  getTopArtists,
  getTopAlbums,
  getLatestPlayAt,
  getRecentStreams,
  parseTimeRange,
  getListeningDiversity,
  getListeningSpan,
  calendarDaysInFilter,
} from "@/lib/stats";
import { formatDistanceToNow } from "date-fns";
import { AlbumArt } from "@/components/album-art";
import { ArtistArt } from "@/components/artist-art";
import { LocalDateTime } from "@/components/local-datetime";
import { cookies } from "next/headers";
import { VIEWER_TIMEZONE_COOKIE } from "@/lib/stats-timezone";

export const dynamic = "force-dynamic";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; tz?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const viewerTimeZone = params.tz ?? cookieStore.get(VIEWER_TIMEZONE_COOKIE)?.value;
  const filter = parseTimeRange(params.range, params.from, params.to, viewerTimeZone);

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
    getTopTracks(5, filter),
    getTopArtists(5, filter),
    getTopAlbums(5, filter),
    getLatestPlayAt(),
    getListeningDiversity(filter),
    getListeningSpan(filter),
    getRecentStreams(10),
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Overview</h1>
            <Badge
              variant="secondary"
              className="rounded-md border-0 bg-muted/80 px-2.5 py-0.5 text-xs font-normal text-muted-foreground"
            >
              {filter.label}
            </Badge>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Rankings for this period are below. Open{" "}
            <Link href="#patterns" className="font-medium text-foreground underline-offset-2 hover:text-primary hover:underline">
              patterns
            </Link>{" "}
            for when you listen, or{" "}
            <Link href="/history" className="font-medium text-foreground underline-offset-2 hover:text-primary hover:underline">
              history
            </Link>{" "}
            for the full chart, play log, and imports.
          </p>
        </div>
        {latestPlayAt ? (
          <p className="shrink-0 text-sm leading-relaxed text-muted-foreground sm:max-w-[14rem] sm:pt-0.5 sm:text-right">
            Last play{" "}
            <span className="font-medium tabular-nums text-foreground">
              {formatDistanceToNow(latestPlayAt, { addSuffix: true })}
            </span>
          </p>
        ) : null}
      </div>

      <OverviewMetricsGrid metrics={metrics} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_min(100%,15.5rem)] lg:items-start xl:grid-cols-[minmax(0,1fr)_min(100%,17.5rem)] xl:gap-5">
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

        <aside className="min-w-0 lg:sticky lg:top-[calc(4.25rem+env(safe-area-inset-top,0px))] lg:self-start">
          <div className="rounded-2xl border border-border/40 bg-border/15 p-px">
            <div className="overflow-hidden rounded-[15px] bg-card/80">
              <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Recent plays
                </h2>
                <Link
                  href="/history/recent"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  View all
                </Link>
              </div>
              <div className="px-2 pb-3 pt-1">
                {recentStreams.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm leading-relaxed text-muted-foreground">
                    Nothing yet.{" "}
                    <Link href="/history/import" className="font-medium text-primary hover:underline">
                      Import data
                    </Link>
                  </p>
                ) : (
                  <ul className="divide-y divide-border/25">
                    {recentStreams.map((stream) => (
                      <li key={stream.id}>
                        <div className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/25">
                          <AlbumArt
                            src={stream.albumArt}
                            alt={stream.albumName}
                            width={32}
                            height={32}
                            className="size-8 shrink-0 rounded-md ring-1 ring-border/25"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium leading-snug">{stream.trackName}</p>
                            <p className="truncate text-xs leading-snug text-muted-foreground">
                              {stream.artistName}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs tabular-nums leading-none text-muted-foreground">
                              <LocalDateTime date={stream.playedAt} pattern="MMM d" />
                            </p>
                            <p className="text-xs tabular-nums leading-none text-muted-foreground">
                              <LocalDateTime date={stream.playedAt} pattern="h:mm a" />
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </aside>
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
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{track.streams}×</span>
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
                          {artist.minutesListened.toLocaleString()} min
                        </p>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {artist.streams.toLocaleString()}×
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
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{album.streams}×</span>
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
