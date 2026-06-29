"use client";

import { Suspense, useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Clock, Headphones, Music, Play, Users } from "lucide-react";
import { InsightCard } from "@/components/insight-card";
import { StatCard } from "@/components/stat-card";
import { ListeningActivity } from "@/components/listening-activity";
import { ArtistArt } from "@/components/artist-art";
import { AlbumArt } from "@/components/album-art";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ContentPanel, PageHeader, PageShell, SectionBlock } from "@/components/page-shell";
import { PageHistoryActions } from "@/components/page-history-actions";
import { LiveSyncStatus } from "@/components/live-sync-status";
import { useStreams } from "@/components/streams-provider";
import { EntityKindTabs, type EntityKind } from "@/components/entity-kind-tabs";
import { RankedEntityList } from "@/components/ranked-entity-list";
import { RecentPlaysPanel } from "@/components/recent-plays-panel";
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

export function OverviewContent() {
  const searchParams = useSearchParams();
  const { streams, loading, loadingMore, refreshing } = useStreams();
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
      <div className="flex py-20 items-center justify-center text-sm text-muted-foreground">
        Loading your stats…
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="flex py-24 flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
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
    <PageShell width="wide">
      <PageHeader
        title="Dashboard"
        description={`Dense overview of ${filter.label.toLowerCase()} listening.`}
        actions={<PageHistoryActions />}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full border border-primary/20 bg-primary/10 text-primary">
              {filter.label}
            </Badge>
            {refreshing || loadingMore ? (
              <Badge variant="secondary" className="rounded-full border border-border/40 bg-secondary/40">
                Updating history
              </Badge>
            ) : null}
            {span ? (
              <span className="text-xs text-muted-foreground">
                {span.first.toLocaleDateString()} – {span.last.toLocaleDateString()}
              </span>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-3 2xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:items-start">
        <div className="space-y-3">
          <section className="space-y-2.5">
            <div>
              <h2 className="font-display text-base font-semibold tracking-tight sm:text-lg">
                Listening at a glance
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                {stats.totalStreams.toLocaleString()} plays · {diversity.uniqueArtists.toLocaleString()} artists ·{" "}
                {diversity.uniqueTracks.toLocaleString()} tracks
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Minutes" value={stats.totalMinutes.toLocaleString()} sub={`${stats.totalHours.toLocaleString()} hours`} icon={Clock} variant="compact" />
              <StatCard label="Plays" value={stats.totalStreams.toLocaleString()} sub={filter.label} icon={Play} variant="compact" />
              <StatCard label="Min / day" value={avgMinPerDay.toLocaleString()} sub={`~${days} days`} icon={Clock} variant="compact" />
              <StatCard label="Plays / day" value={avgStreamsPerDay.toLocaleString()} icon={Headphones} variant="compact" />
              <StatCard label="Tracks" value={diversity.uniqueTracks.toLocaleString()} sub="unique" icon={Music} variant="compact" />
              <StatCard label="Artists" value={diversity.uniqueArtists.toLocaleString()} sub="unique" icon={Users} variant="compact" />
            </div>
          </section>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
            <Suspense
              fallback={
                <Card className="rounded-xl border border-border/40 bg-card/40 shadow-none ring-0">
                  <CardContent className="flex h-[220px] items-center justify-center px-4 text-sm text-muted-foreground">
                    Loading chart…
                  </CardContent>
                </Card>
              }
            >
              <ListeningActivity periodLabel={filter.label} compact />
            </Suspense>

            <SectionBlock
              title="Top rankings"
              description={`By ${sortBy}`}
              action={
                <Link href={libraryRankingsHref} className="text-xs font-medium text-primary hover:underline">
                  See all
                </Link>
              }
            >
              <EntityKindTabs value={previewKind} onValueChange={setPreviewKind} />
              <ContentPanel>
                <TopPreviewList
                  kind={previewKind}
                  sortBy={sortBy}
                  tracks={topTracks}
                  artists={topArtists}
                  albums={topAlbums}
                />
              </ContentPanel>
            </SectionBlock>
          </div>
        </div>

        <aside className="space-y-3 2xl:sticky 2xl:top-[calc(4.25rem+env(safe-area-inset-top,0px))]">
          <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
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

          <RecentPlaysPanel
            compact
            streams={recentStreams}
            description={`Last ${recentStreams.length} listens`}
            action={
              <Link href={libraryRecentHref} className="text-xs font-medium text-primary hover:underline">
                See all
              </Link>
            }
          />
        </aside>
      </div>
    </PageShell>
  );
}

function TopPreviewList({
  kind,
  sortBy,
  tracks,
  artists,
  albums,
}: {
  kind: EntityKind;
  sortBy: "minutes" | "streams";
  tracks: ReturnType<typeof computeTopTracks>;
  artists: ReturnType<typeof computeTopArtists>;
  albums: ReturnType<typeof computeTopAlbums>;
}) {
  if (kind === "tracks") {
    return (
      <RankedEntityList
        columns="one"
        sortBy={sortBy}
        items={tracks.map((track) => ({
          key: track.trackId,
          href: trackPath(track.artistName, track.trackName),
          title: track.trackName,
          subtitle: track.artistName,
          streams: track.streams,
          minutes: track.minutesListened,
          leading: track.albumArt ? (
            <Image src={track.albumArt} alt={track.albumName} width={34} height={34} className="size-8 shrink-0 rounded" />
          ) : (
            <div className="size-8 shrink-0 rounded bg-secondary" />
          ),
        }))}
      />
    );
  }

  if (kind === "artists") {
    return (
      <RankedEntityList
        columns="one"
        sortBy={sortBy}
        items={artists.map((artist) => ({
          key: artist.artistName,
          href: artistPath(artist.artistName),
          title: artist.artistName,
          subtitle:
            sortBy === "streams"
              ? `${artist.minutesListened.toLocaleString()} min`
              : `${artist.streams.toLocaleString()} plays`,
          streams: artist.streams,
          minutes: artist.minutesListened,
          leading: <ArtistArt src={artist.artistArt} alt={artist.artistName} width={34} height={34} className="size-8 ring-1 ring-border/25" />,
        }))}
      />
    );
  }

  return (
    <RankedEntityList
      columns="one"
      sortBy={sortBy}
      items={albums.map((album) => ({
        key: `${album.albumName}-${album.artistName}`,
        href: albumPath(album.artistName, album.albumName),
        title: album.albumName,
        subtitle: album.artistName,
        streams: album.streams,
        minutes: album.minutesListened,
        leading: <AlbumArt src={album.albumArt} alt={album.albumName} width={34} height={34} className="size-8 shrink-0 rounded-md" />,
      }))}
    />
  );
}
