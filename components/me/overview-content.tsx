"use client";

import { Suspense, useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { useSearchParams } from "next/navigation";
import { Clock, Headphones, Music, Play, Users } from "lucide-react";
import { FilterToolbar } from "@/components/filter-toolbar";
import { InsightCard } from "@/components/insight-card";
import { StatCard } from "@/components/stat-card";
import { ListeningActivity } from "@/components/listening-activity";
import { RecentPlaysList } from "@/components/recent-plays-list";
import { ArtistArt } from "@/components/artist-art";
import { AlbumArt } from "@/components/album-art";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useStreams } from "@/components/streams-provider";
import { librarySectionHref } from "@/components/library/library-content";
import {
  calendarDaysInFilter,
  computeListeningDiversity,
  computeListeningSpan,
  computePeakDay,
  computePeakHour,
  computeRecentStreams,
  computeTopAlbums,
  computeTopArtists,
  computeTopTracks,
  computeTotalStats,
  formatHourLabel,
  parseTimeRange,
  parseTopSortBy,
} from "@/lib/stats-compute";
import { albumPath, artistPath, trackPath } from "@/lib/entity-paths";
import { VIEWER_TIMEZONE_PARAM } from "@/lib/stats-timezone";
import {
  detectViewerTimeZone,
  readViewerTimeZoneCookie,
} from "@/lib/viewer-timezone-client";
import { cn } from "@/lib/utils";

const previewKinds = [
  { id: "tracks", label: "Tracks" },
  { id: "artists", label: "Artists" },
  { id: "albums", label: "Albums" },
] as const;

export function OverviewContent() {
  const searchParams = useSearchParams();
  const { streams, loading, loadingMore, fullyLoaded, hasMore } = useStreams();
  const deferredStreams = useDeferredValue(streams);
  const [previewKind, setPreviewKind] = useState<(typeof previewKinds)[number]["id"]>("tracks");

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

  const stats = useMemo(() => computeTotalStats(deferredStreams, filter), [deferredStreams, filter]);
  const topTracks = useMemo(() => computeTopTracks(deferredStreams, 5, filter, sortBy), [deferredStreams, filter, sortBy]);
  const topArtists = useMemo(() => computeTopArtists(deferredStreams, 5, filter, sortBy), [deferredStreams, filter, sortBy]);
  const topAlbums = useMemo(() => computeTopAlbums(deferredStreams, 5, filter, sortBy), [deferredStreams, filter, sortBy]);
  const diversity = useMemo(() => computeListeningDiversity(deferredStreams, filter), [deferredStreams, filter]);
  const span = useMemo(() => computeListeningSpan(deferredStreams, filter), [deferredStreams, filter]);
  const recentStreams = useMemo(() => computeRecentStreams(deferredStreams, 7), [deferredStreams]);
  const peakHour = useMemo(
    () => computePeakHour(deferredStreams, filter, viewerTimeZone ?? undefined),
    [deferredStreams, filter, viewerTimeZone]
  );
  const peakDay = useMemo(
    () => computePeakDay(deferredStreams, filter, viewerTimeZone ?? undefined),
    [deferredStreams, filter, viewerTimeZone]
  );

  const days = calendarDaysInFilter(filter, span, viewerTimeZone ?? undefined);
  const avgMinPerDay = Math.round(stats.totalMinutes / days);
  const avgStreamsPerDay = Math.round(stats.totalStreams / days);
  const hasData = stats.totalStreams > 0;

  const libraryRecentHref = librarySectionHref("recent", new URLSearchParams(searchParams.toString()));
  const libraryRankingsHref = librarySectionHref("rankings", new URLSearchParams(searchParams.toString()));

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
        <Link href="/history/import" className="text-sm font-medium text-primary hover:underline">
          Import on web
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 sm:space-y-5">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard</h1>
        {!fullyLoaded && hasMore ? (
          <p className="text-xs text-muted-foreground">
            {loadingMore
              ? `Loading older plays (${streams.length.toLocaleString()} loaded so far).`
              : "Recent plays loaded. Use Load more in the banner for older history."}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">How you&apos;re listening in {filter.label.toLowerCase()}.</p>
      </div>

      <FilterToolbar context="dashboard" />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="rounded-full border border-primary/20 bg-primary/10 text-primary">
          {filter.label}
        </Badge>
        {span ? (
          <span className="text-xs text-muted-foreground">
            {span.first.toLocaleDateString()} – {span.last.toLocaleDateString()}
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Minutes" value={stats.totalMinutes.toLocaleString()} sub={`${stats.totalHours.toLocaleString()} hours`} icon={Clock} />
        <StatCard label="Plays" value={stats.totalStreams.toLocaleString()} sub={filter.label} icon={Play} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tracks" value={diversity.uniqueTracks.toLocaleString()} sub="unique" icon={Music} variant="compact" />
        <StatCard label="Artists" value={diversity.uniqueArtists.toLocaleString()} sub="unique" icon={Users} variant="compact" />
        <StatCard label="Min / day" value={avgMinPerDay.toLocaleString()} sub={`~${days} days`} icon={Clock} variant="compact" />
        <StatCard label="Plays / day" value={avgStreamsPerDay.toLocaleString()} icon={Headphones} variant="compact" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <InsightCard
          label="Busiest hour"
          primaryValue={peakHour ? formatHourLabel(peakHour.label) : "—"}
          detail={
            peakHour
              ? `${peakHour.minutes.toLocaleString()} min · ${peakHour.streams.toLocaleString()} plays`
              : "No plays in this range."
          }
        />
        <InsightCard
          label="Busiest day"
          primaryValue={peakDay?.label ?? "—"}
          detail={
            peakDay
              ? `${peakDay.minutes.toLocaleString()} min · ${peakDay.streams.toLocaleString()} plays`
              : "No plays in this range."
          }
        />
      </div>

      <Suspense
        fallback={
          <Card className="rounded-2xl border border-border/40 bg-card/40 shadow-none ring-0">
            <CardContent className="flex h-[240px] items-center justify-center px-4 text-sm text-muted-foreground">
              Loading chart…
            </CardContent>
          </Card>
        }
      >
        <ListeningActivity periodLabel={filter.label} compact />
      </Suspense>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Recent plays</h2>
            <p className="text-xs text-muted-foreground">Last {recentStreams.length} listens</p>
          </div>
          <Link href={libraryRecentHref} className="text-sm font-medium text-primary hover:underline">
            See all
          </Link>
        </div>
        <Card className="border-border/50 bg-card/70">
          <CardContent className="p-3 sm:p-4">
            <RecentPlaysList
              compact
              linkable
              initialStreams={recentStreams.map((stream) => ({
                id: stream.id,
                trackName: stream.trackName,
                artistName: stream.artistName,
                albumName: stream.albumName,
                albumArt: stream.albumArt,
                playedAt: stream.playedAt.toISOString(),
              }))}
            />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Top rankings</h2>
            <p className="text-xs text-muted-foreground">By {sortBy}</p>
          </div>
          <Link href={libraryRankingsHref} className="text-sm font-medium text-primary hover:underline">
            See all
          </Link>
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl border border-border/40 bg-card/30 p-1">
          {previewKinds.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPreviewKind(item.id)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                previewKind === item.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <Card className="border-border/50 bg-card/70">
          <CardContent className="p-3 sm:p-4">
            <TopPreviewList
              kind={previewKind}
              sortBy={sortBy}
              tracks={topTracks}
              artists={topArtists}
              albums={topAlbums}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function TopPreviewList({
  kind,
  sortBy,
  tracks,
  artists,
  albums,
}: {
  kind: (typeof previewKinds)[number]["id"];
  sortBy: "minutes" | "streams";
  tracks: ReturnType<typeof computeTopTracks>;
  artists: ReturnType<typeof computeTopArtists>;
  albums: ReturnType<typeof computeTopAlbums>;
}) {
  if (kind === "tracks") {
    return (
      <ul className="space-y-1">
        {tracks.map((track, i) => (
          <li key={track.trackId}>
            <Link
              href={trackPath(track.artistName, track.trackName)}
              className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/25"
            >
              <span className="w-5 text-center text-xs text-muted-foreground">{i + 1}</span>
              {track.albumArt ? (
                <Image src={track.albumArt} alt={track.albumName} width={36} height={36} className="rounded" />
              ) : (
                <div className="size-9 rounded bg-secondary" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{track.trackName}</p>
                <p className="truncate text-xs text-muted-foreground">{track.artistName}</p>
              </div>
              <span className="text-xs text-muted-foreground">
                {sortBy === "streams"
                  ? `${track.streams.toLocaleString()} plays`
                  : `${track.minutesListened.toLocaleString()} min`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  if (kind === "artists") {
    return (
      <ul className="space-y-1">
        {artists.map((artist, i) => (
          <li key={artist.artistName}>
            <Link
              href={artistPath(artist.artistName)}
              className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/25"
            >
              <span className="w-5 text-center text-xs text-muted-foreground">{i + 1}</span>
              <ArtistArt src={artist.artistArt} alt={artist.artistName} width={36} height={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{artist.artistName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {sortBy === "streams"
                    ? `${artist.minutesListened.toLocaleString()} min`
                    : `${artist.streams.toLocaleString()} plays`}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {sortBy === "streams"
                  ? `${artist.streams.toLocaleString()} plays`
                  : `${artist.minutesListened.toLocaleString()} min`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="space-y-1">
      {albums.map((album, i) => (
        <li key={`${album.albumName}-${album.artistName}`}>
          <Link
            href={albumPath(album.artistName, album.albumName)}
            className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/25"
          >
            <span className="w-5 text-center text-xs text-muted-foreground">{i + 1}</span>
            <AlbumArt src={album.albumArt} alt={album.albumName} width={36} height={36} className="size-9 rounded-md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{album.albumName}</p>
              <p className="truncate text-xs text-muted-foreground">{album.artistName}</p>
            </div>
            <span className="text-xs text-muted-foreground">
              {sortBy === "streams"
                ? `${album.streams.toLocaleString()} plays`
                : `${album.minutesListened.toLocaleString()} min`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
