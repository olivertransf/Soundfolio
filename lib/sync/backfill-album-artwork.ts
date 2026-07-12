"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";
import { albumGroupKey, normalizeEntityKey } from "@/lib/entity-normalize";
import { patchUserStreamAlbumArt } from "@/lib/firestore/streams";
import { isUsableArtUrl } from "@/lib/stats-compute";
import type { Stream } from "@/lib/types/stream";

const RESOLVE_BATCH = 10;

export type AlbumArtBackfillProgress = {
  message: string;
  resolvedAlbums: number;
  totalAlbums: number;
  updatedStreams: number;
};

export type AlbumArtBackfillResult = {
  uniqueAlbums: number;
  foundArt: number;
  updatedStreams: number;
  skipped: boolean;
  message: string;
};

type ResolveResponse = {
  arts?: Record<string, string | null>;
  error?: string;
  detail?: string;
};

type AlbumLookup = {
  key: string;
  artist: string;
  album: string;
  track: string;
};

function streamAlbumArtKey(stream: Stream) {
  if (stream.albumName.trim()) {
    return albumGroupKey(stream.albumName, stream.artistName);
  }
  return `track:${normalizeEntityKey(stream.trackName)}\0${normalizeEntityKey(stream.artistName)}`;
}

/**
 * Resolve album/cover art for streams missing usable albumArt,
 * write to Firestore, and return the patched stream list.
 */
export async function backfillAlbumArtwork(
  uid: string,
  streams: Stream[],
  onProgress?: (progress: AlbumArtBackfillProgress) => void
): Promise<{ result: AlbumArtBackfillResult; streams: Stream[] }> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user || user.uid !== uid) {
    throw new Error("Sign in to backfill album artwork.");
  }

  const missingByKey = new Map<string, AlbumLookup>();
  for (const stream of streams) {
    if (isUsableArtUrl(stream.albumArt)) continue;
    const key = streamAlbumArtKey(stream);
    if (!key || missingByKey.has(key)) continue;
    missingByKey.set(key, {
      key,
      artist: stream.artistName,
      album: stream.albumName,
      track: stream.trackName,
    });
  }

  const list = [...missingByKey.values()];
  if (list.length === 0) {
    return {
      result: {
        uniqueAlbums: 0,
        foundArt: 0,
        updatedStreams: 0,
        skipped: true,
        message: "Every loaded play already has album art.",
      },
      streams,
    };
  }

  const artByKey = new Map<string, string>();
  const token = await user.getIdToken(true);
  let foundArt = 0;

  onProgress?.({
    message: `Looking up ${list.length.toLocaleString()} albums…`,
    resolvedAlbums: 0,
    totalAlbums: list.length,
    updatedStreams: 0,
  });

  for (let i = 0; i < list.length; i += RESOLVE_BATCH) {
    const batch = list.slice(i, i + RESOLVE_BATCH);
    const response = await fetch("/api/resolve-album-art", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ albums: batch }),
    });
    const data = (await response.json()) as ResolveResponse;
    if (!response.ok) {
      throw new Error(data.detail ?? data.error ?? "Could not resolve album artwork.");
    }

    for (const [key, art] of Object.entries(data.arts ?? {})) {
      if (!isUsableArtUrl(art)) continue;
      artByKey.set(key, art);
      foundArt += 1;
    }

    onProgress?.({
      message: `Checked ${Math.min(i + batch.length, list.length).toLocaleString()} / ${list.length.toLocaleString()} albums…`,
      resolvedAlbums: Math.min(i + batch.length, list.length),
      totalAlbums: list.length,
      updatedStreams: 0,
    });
  }

  const patches: Array<{ id: string; albumArt: string }> = [];
  const nextStreams = streams.map((stream) => {
    if (isUsableArtUrl(stream.albumArt)) return stream;
    const art = artByKey.get(streamAlbumArtKey(stream));
    if (!art) return stream;
    patches.push({ id: stream.id, albumArt: art });
    return {
      ...stream,
      albumArt: art,
      updatedAt: new Date(),
    };
  });

  onProgress?.({
    message: `Saving artwork on ${patches.length.toLocaleString()} plays…`,
    resolvedAlbums: list.length,
    totalAlbums: list.length,
    updatedStreams: 0,
  });

  const updatedStreams = await patchUserStreamAlbumArt(uid, patches);

  return {
    result: {
      uniqueAlbums: list.length,
      foundArt,
      updatedStreams,
      skipped: false,
      message:
        updatedStreams > 0
          ? `Updated ${updatedStreams.toLocaleString()} plays (${foundArt.toLocaleString()} of ${list.length.toLocaleString()} albums found)`
          : foundArt === 0
            ? `No artwork found for ${list.length.toLocaleString()} albums`
            : "Artwork already up to date",
    },
    streams: nextStreams,
  };
}
