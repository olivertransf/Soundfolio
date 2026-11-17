"use client";

import { format } from "date-fns";
import { AlbumArt } from "@/components/album-art";
import { ArtistArt } from "@/components/artist-art";
import type { CoverItem } from "@/components/visual/cover-rail";
import { albumPath, artistPath, trackPath } from "@/lib/entity-paths";
import { minutesFromMs } from "@/lib/listening-minutes";
import type { Stream } from "@/lib/types/stream";

const art = "size-full object-cover";

export function trackCovers(
  tracks: {
    trackName: string;
    artistName: string;
    albumName: string;
    albumArt: string | null;
    minutesListened: number;
  }[],
  base: string
): CoverItem[] {
  return tracks.map((track) => ({
    key: `${track.artistName}-${track.trackName}`,
    href: `${base}${trackPath(track.artistName, track.trackName)}`,
    title: track.trackName,
    subtitle: track.artistName,
    minutes: track.minutesListened,
    art: (
      <AlbumArt
        src={track.albumArt}
        alt={track.albumName}
        width={176}
        height={176}
        className={art}
      />
    ),
  }));
}

export function artistCovers(
  artists: {
    artistName: string;
    artistArt: string | null;
    minutesListened: number;
  }[],
  base: string
): CoverItem[] {
  return artists.map((artist) => ({
    key: artist.artistName,
    href: `${base}${artistPath(artist.artistName)}`,
    title: artist.artistName,
    minutes: artist.minutesListened,
    art: (
      <ArtistArt
        src={artist.artistArt}
        alt={artist.artistName}
        width={176}
        height={176}
        className="size-full"
      />
    ),
  }));
}

export function albumCovers(
  albums: {
    albumName: string;
    artistName: string;
    albumArt: string | null;
    minutesListened: number;
  }[],
  base: string
): CoverItem[] {
  return albums.map((album) => ({
    key: `${album.artistName}-${album.albumName}`,
    href: `${base}${albumPath(album.artistName, album.albumName)}`,
    title: album.albumName,
    subtitle: album.artistName,
    minutes: album.minutesListened,
    art: (
      <AlbumArt
        src={album.albumArt}
        alt={album.albumName}
        width={176}
        height={176}
        className={art}
      />
    ),
  }));
}

export function recentCovers(streams: Stream[], base: string): CoverItem[] {
  return streams.map((stream) => ({
    key: stream.id,
    href: `${base}${trackPath(stream.artistName, stream.trackName)}`,
    title: stream.trackName,
    subtitle: stream.artistName,
    detail: format(stream.playedAt, "MMM d · h:mm a"),
    art: (
      <AlbumArt
        src={stream.albumArt}
        alt={stream.albumName}
        width={176}
        height={176}
        className={art}
      />
    ),
  }));
}

export function playCovers(
  plays: { id: string; albumName: string; albumArt: string | null; playedAt: Date; durationMs: number }[]
): CoverItem[] {
  return plays.map((play) => ({
    key: play.id,
    title: format(play.playedAt, "MMM d"),
    detail: format(play.playedAt, "h:mm a"),
    minutes: minutesFromMs(play.durationMs),
    art: (
      <AlbumArt
        src={play.albumArt}
        alt={play.albumName}
        width={176}
        height={176}
        className={art}
      />
    ),
  }));
}
