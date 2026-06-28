"use client";

import { Suspense, useMemo, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { FilterToolbar } from "@/components/filter-toolbar";
import { RankedStreamRow } from "@/components/ranked-stream-row";
import { ArtistArt } from "@/components/artist-art";
import { useStreams } from "@/components/streams-provider";
import {
  computeTopAlbums,
  computeTopArtists,
  computeTopTracks,
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

const kinds = [
  { id: "tracks", label: "Tracks" },
  { id: "artists", label: "Artists" },
  { id: "albums", label: "Albums" },
] as const;

function RankingsSectionInner() {
  const searchParams = useSearchParams();
  const { streams, loading } = useStreams();
  const [kind, setKind] = useState<(typeof kinds)[number]["id"]>("tracks");

  const range = searchParams.get("range") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const viewerTimeZone =
    searchParams.get(VIEWER_TIMEZONE_PARAM) ??
    readViewerTimeZoneCookie() ??
    detectViewerTimeZone();
  const sortBy = parseTopSortBy(searchParams.get("sort") ?? undefined);
  const filter = useMemo(
    () => parseTimeRange(range, from, to, viewerTimeZone ?? undefined),
    [range, from, to, viewerTimeZone]
  );

  const tracks = useMemo(
    () => computeTopTracks(streams, 50, filter, sortBy),
    [streams, filter, sortBy]
  );
  const artists = useMemo(
    () => computeTopArtists(streams, 50, filter, sortBy),
    [streams, filter, sortBy]
  );
  const albums = useMemo(
    () => computeTopAlbums(streams, 50, filter, sortBy),
    [streams, filter, sortBy]
  );

  if (loading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <FilterToolbar context="rankings" />
      <div className="flex flex-wrap gap-1 rounded-xl border border-border/40 bg-card/30 p-1">
        {kinds.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setKind(item.id)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              kind === item.id
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <Card className="border-border/50 bg-card/70" size="sm">
        <CardContent className="p-2.5 sm:p-3">
          {kind === "tracks" ? (
            <RankedList
              items={tracks.map((track) => ({
                key: track.trackId,
                href: trackPath(track.artistName, track.trackName),
                title: track.trackName,
                subtitle: track.artistName,
                streams: track.streams,
                minutes: track.minutesListened,
                leading: track.albumArt ? (
                  <Image src={track.albumArt} alt={track.albumName} width={36} height={36} className="size-9 shrink-0 rounded" />
                ) : (
                  <div className="size-9 shrink-0 rounded bg-secondary" />
                ),
              }))}
              sortBy={sortBy}
            />
          ) : null}
          {kind === "artists" ? (
            <RankedList
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
                leading: (
                  <ArtistArt
                    src={artist.artistArt}
                    alt={artist.artistName}
                    width={36}
                    height={36}
                    className="size-9 ring-1 ring-border/25"
                  />
                ),
              }))}
              sortBy={sortBy}
            />
          ) : null}
          {kind === "albums" ? (
            <RankedList
              items={albums.map((album) => ({
                key: `${album.albumName}-${album.artistName}`,
                href: albumPath(album.artistName, album.albumName),
                title: album.albumName,
                subtitle: album.artistName,
                streams: album.streams,
                minutes: album.minutesListened,
                leading: album.albumArt ? (
                  <Image src={album.albumArt} alt={album.albumName} width={36} height={36} className="size-9 shrink-0 rounded" />
                ) : (
                  <div className="size-9 shrink-0 rounded bg-secondary" />
                ),
              }))}
              sortBy={sortBy}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function RankedList({
  items,
  sortBy,
}: {
  items: Array<{
    key: string;
    href: string;
    title: string;
    subtitle?: string;
    streams: number;
    minutes: number;
    leading: React.ReactNode;
  }>;
  sortBy: "streams" | "minutes";
}) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">No data for this time range.</p>;
  }
  return (
    <div className="grid gap-0.5 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item, i) => (
        <RankedStreamRow
          key={item.key}
          rank={i + 1}
          padding="compact"
          sortBy={sortBy}
          href={item.href}
          leading={item.leading}
          title={item.title}
          subtitle={item.subtitle}
          streams={item.streams}
          minutes={item.minutes}
        />
      ))}
    </div>
  );
}

export function LibraryRankingsSection() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading rankings…</p>}>
      <RankingsSectionInner />
    </Suspense>
  );
}
