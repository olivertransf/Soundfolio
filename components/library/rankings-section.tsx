"use client";

import { Suspense, useMemo, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { ContentPanel } from "@/components/page-shell";
import { FilterToolbar } from "@/components/filter-toolbar";
import { EntityKindTabs, type EntityKind } from "@/components/entity-kind-tabs";
import { RankedEntityList, type RankedEntityItem } from "@/components/ranked-entity-list";
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

function RankingsSectionInner() {
  const searchParams = useSearchParams();
  const { streams, loading } = useStreams();
  const [kind, setKind] = useState<EntityKind>("tracks");

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
    <div className="space-y-3">
      <FilterToolbar context="rankings" />
      <EntityKindTabs value={kind} onValueChange={setKind} />
      <ContentPanel>
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
      </ContentPanel>
    </div>
  );
}

function RankedList({
  items,
  sortBy,
}: {
  items: RankedEntityItem[];
  sortBy: "streams" | "minutes";
}) {
  return <RankedEntityList items={items} sortBy={sortBy} columns="three" />;
}

export function LibraryRankingsSection() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading rankings…</p>}>
      <RankingsSectionInner />
    </Suspense>
  );
}
