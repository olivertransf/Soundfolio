"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Clock, Headphones, Music, Play, Users } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { ArtistArt } from "@/components/artist-art";
import { AlbumArt } from "@/components/album-art";
import { PageShell } from "@/components/page-shell";
import { LiveSyncStatus } from "@/components/live-sync-status";
import { useStreams } from "@/components/streams-provider";
import { EntityKindTabs, type EntityKind } from "@/components/entity-kind-tabs";
import { RankedEntityList } from "@/components/ranked-entity-list";
import { RankColumn, ResponsiveColumns } from "@/components/responsive-columns";
import { RecentPlaysPanel, RecentPlaysSeeAllLink } from "@/components/recent-plays-panel";
import { FilterToolbar } from "@/components/filter-toolbar";
import { librarySectionHref } from "@/components/library/library-content";
import {
  calendarDaysInFilter,
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
import { albumPath, artistPath, trackPath } from "@/lib/entity-paths";
import { VIEWER_TIMEZONE_PARAM } from "@/lib/stats-timezone";
import {
  detectViewerTimeZone,
  readViewerTimeZoneCookie,
} from "@/lib/viewer-timezone-client";

const TOP_PREVIEW = 20;
const RECENT_PREVIEW = 40;

export function OverviewContent() {
  const searchParams = useSearchParams();
  const { streams, loading, loadingMore, refreshing, fullyLoaded } = useStreams();
  const deferredStreams = useDeferredValue(streams);
  const [previewKind, setPreviewKind] = useState<EntityKind>("tracks");

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
  const topTracks = useMemo(
    () => computeTopTracks(deferredStreams, TOP_PREVIEW, filter, sortBy),
    [deferredStreams, filter, sortBy]
  );
  const topArtists = useMemo(
    () => computeTopArtists(deferredStreams, TOP_PREVIEW, filter, sortBy),
    [deferredStreams, filter, sortBy]
  );
  const topAlbums = useMemo(
    () => computeTopAlbums(deferredStreams, TOP_PREVIEW, filter, sortBy),
    [deferredStreams, filter, sortBy]
  );
  const diversity = useMemo(
    () => computeListeningDiversity(deferredStreams, filter),
    [deferredStreams, filter]
  );
  const span = useMemo(
    () => computeListeningSpan(deferredStreams, filter),
    [deferredStreams, filter]
  );
  const recentStreams = useMemo(
    () => computeRecentStreams(deferredStreams, RECENT_PREVIEW),
    [deferredStreams]
  );

  const days = calendarDaysInFilter(filter, span, viewerTimeZone ?? undefined);
  const avgMinPerDay = Math.round(stats.totalMinutes / days);
  const avgStreamsPerDay = Math.round(stats.totalStreams / days);
  const hasData = stats.totalStreams > 0;

  const libraryRecentHref = librarySectionHref(
    "recent",
    new URLSearchParams(searchParams.toString())
  );
  const libraryRankingsHref = librarySectionHref(
    "rankings",
    new URLSearchParams(searchParams.toString())
  );

  if (loading) {
    return (
      <div className="flex py-20 items-center justify-center text-sm text-muted-foreground">
        Loading your stats…
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="flex py-24 flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center bg-primary/10">
          <Music className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">No data yet</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Sync Last.fm or import your listening history to see stats here.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <LiveSyncStatus />
          <Link href="/history/import" className="text-sm font-medium text-primary hover:underline">
            Import on web
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PageShell className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-3">
          <FilterToolbar context="dashboard" />

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard
              label="Minutes"
              value={stats.totalMinutes.toLocaleString()}
              sub={`${stats.totalHours.toLocaleString()} hrs`}
              icon={Clock}
              variant="compact"
            />
            <StatCard
              label="Plays"
              value={stats.totalStreams.toLocaleString()}
              icon={Play}
              variant="compact"
            />
            <StatCard
              label="Min / day"
              value={avgMinPerDay.toLocaleString()}
              sub={`~${days}d`}
              icon={Clock}
              variant="compact"
            />
            <StatCard
              label="Plays / day"
              value={avgStreamsPerDay.toLocaleString()}
              icon={Headphones}
              variant="compact"
            />
            <StatCard
              label="Tracks"
              value={diversity.uniqueTracks.toLocaleString()}
              icon={Music}
              variant="compact"
            />
            <StatCard
              label="Artists"
              value={diversity.uniqueArtists.toLocaleString()}
              icon={Users}
              variant="compact"
            />
          </div>

          {!fullyLoaded || loadingMore ? (
            <p className="text-xs text-muted-foreground">
              Loading full history… totals can rise as older plays arrive (
              {streams.length.toLocaleString()} loaded)
            </p>
          ) : refreshing ? (
            <p className="text-xs text-muted-foreground">Updating history…</p>
          ) : null}

          <section className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold tracking-tight">Top rankings</h2>
              <Link
                href={libraryRankingsHref}
                className="text-xs font-medium text-primary hover:underline"
              >
                See all
              </Link>
            </div>
            <DashboardTopRankings
              sortBy={sortBy}
              previewKind={previewKind}
              onPreviewKindChange={setPreviewKind}
              tracks={topTracks}
              artists={topArtists}
              albums={topAlbums}
            />
          </section>
        </div>

        <aside className="flex min-h-[24rem] min-w-0 flex-col lg:sticky lg:top-[calc(3.5rem+env(safe-area-inset-top,0px))] lg:h-[calc(100dvh-4.5rem-env(safe-area-inset-top,0px))]">
          <RecentPlaysPanel
            compact
            className="min-h-0 flex-1"
            streams={recentStreams}
            action={<RecentPlaysSeeAllLink href={libraryRecentHref} />}
          />
        </aside>
      </div>
    </PageShell>
  );
}

function DashboardTopRankings({
  sortBy,
  previewKind,
  onPreviewKindChange,
  tracks,
  artists,
  albums,
}: {
  sortBy: "minutes" | "streams";
  previewKind: EntityKind;
  onPreviewKindChange: (kind: EntityKind) => void;
  tracks: ReturnType<typeof computeTopTracks>;
  artists: ReturnType<typeof computeTopArtists>;
  albums: ReturnType<typeof computeTopAlbums>;
}) {
  const trackItems = tracks.map((track) => ({
    key: track.trackId,
    href: trackPath(track.artistName, track.trackName),
    title: track.trackName,
    subtitle: track.artistName,
    streams: track.streams,
    minutes: track.minutesListened,
    leading: (
      <AlbumArt
        src={track.albumArt}
        alt={track.albumName}
        width={32}
        height={32}
        className="size-8 shrink-0 rounded"
      />
    ),
  }));
  const artistItems = artists.map((artist) => ({
    key: artist.artistName,
    href: artistPath(artist.artistName),
    title: artist.artistName,
    streams: artist.streams,
    minutes: artist.minutesListened,
    leading: (
      <ArtistArt
        src={artist.artistArt}
        alt={artist.artistName}
        width={32}
        height={32}
        className="size-8 ring-1 ring-border"
      />
    ),
  }));
  const albumItems = albums.map((album) => ({
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
        width={32}
        height={32}
        className="size-8 shrink-0 rounded"
      />
    ),
  }));
  const singleItems =
    previewKind === "tracks"
      ? trackItems
      : previewKind === "artists"
        ? artistItems
        : albumItems;

  return (
    <>
      <div className="space-y-2 xl:hidden">
        <EntityKindTabs value={previewKind} onValueChange={onPreviewKindChange} />
        <div className="border border-border bg-card p-1.5">
          <RankedEntityList items={singleItems} sortBy={sortBy} columns="one" />
        </div>
      </div>
      <ResponsiveColumns className="hidden xl:grid" cols={3}>
        <RankColumn title="Tracks" stickyHeader={false}>
          <RankedEntityList items={trackItems} sortBy={sortBy} columns="one" />
        </RankColumn>
        <RankColumn title="Artists" stickyHeader={false}>
          <RankedEntityList items={artistItems} sortBy={sortBy} columns="one" />
        </RankColumn>
        <RankColumn title="Albums" stickyHeader={false}>
          <RankedEntityList items={albumItems} sortBy={sortBy} columns="one" />
        </RankColumn>
      </ResponsiveColumns>
    </>
  );
}
