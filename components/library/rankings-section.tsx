"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FilterToolbar } from "@/components/filter-toolbar";
import { EntityKindTabs, type EntityKind } from "@/components/entity-kind-tabs";
import { RankedEntityList, type RankedEntityItem } from "@/components/ranked-entity-list";
import { RankColumn, ResponsiveColumns } from "@/components/responsive-columns";
import { ArtistArt } from "@/components/artist-art";
import { AlbumArt } from "@/components/album-art";
import { useStreams } from "@/components/streams-provider";
import { ShowMoreButton } from "@/components/show-more-button";
import { useListDepth } from "@/components/use-list-depth";
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
  const limits = useListDepth();
  const [kind, setKind] = useState<EntityKind>("tracks");
  const [shown, setShown] = useState<number>(limits.page);

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
    () => computeTopTracks(streams, streams.length, filter, sortBy),
    [streams, filter, sortBy]
  );
  const artists = useMemo(
    () => computeTopArtists(streams, streams.length, filter, sortBy),
    [streams, filter, sortBy]
  );
  const albums = useMemo(
    () => computeTopAlbums(streams, streams.length, filter, sortBy),
    [streams, filter, sortBy]
  );

  const trackItems: RankedEntityItem[] = tracks.map((track) => ({
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
        width={36}
        height={36}
        className="size-9 shrink-0 rounded"
      />
    ),
  }));

  const artistItems: RankedEntityItem[] = artists.map((artist) => ({
    key: artist.artistName,
    href: artistPath(artist.artistName),
    title: artist.artistName,
    streams: artist.streams,
    minutes: artist.minutesListened,
    leading: (
      <ArtistArt
        src={artist.artistArt}
        alt={artist.artistName}
        width={36}
        height={36}
        className="size-9 ring-1 ring-border"
      />
    ),
  }));

  const albumItems: RankedEntityItem[] = albums.map((album) => ({
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
        width={36}
        height={36}
        className="size-9 shrink-0 rounded"
      />
    ),
  }));

  if (loading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  const singleItems =
    kind === "tracks" ? trackItems : kind === "artists" ? artistItems : albumItems;
  const visibleSingle = singleItems.slice(0, shown);
  const visibleTracks = trackItems.slice(0, shown);
  const visibleArtists = artistItems.slice(0, shown);
  const visibleAlbums = albumItems.slice(0, shown);
  const longest = Math.max(trackItems.length, artistItems.length, albumItems.length, singleItems.length);

  return (
    <div className="space-y-3">
      <FilterToolbar context="rankings" />

      <div className="xl:hidden">
        <EntityKindTabs value={kind} onValueChange={setKind} />
        <div className="mt-3 border border-border bg-card p-1.5 sm:p-2">
          <RankedEntityList items={visibleSingle} sortBy={sortBy} columns="one" />
          <ShowMoreButton
            shown={Math.min(shown, singleItems.length)}
            total={singleItems.length}
            onShowMore={() => setShown((count) => count + limits.page)}
          />
        </div>
      </div>

      <div className="hidden xl:block">
        <ResponsiveColumns className="grid" cols={3}>
          <RankColumn title="Tracks">
            <RankedEntityList items={visibleTracks} sortBy={sortBy} columns="one" />
          </RankColumn>
          <RankColumn title="Artists">
            <RankedEntityList items={visibleArtists} sortBy={sortBy} columns="one" />
          </RankColumn>
          <RankColumn title="Albums">
            <RankedEntityList items={visibleAlbums} sortBy={sortBy} columns="one" />
          </RankColumn>
        </ResponsiveColumns>
        <ShowMoreButton
          shown={Math.min(shown, longest)}
          total={longest}
          onShowMore={() => setShown((count) => count + limits.page)}
        />
      </div>
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
