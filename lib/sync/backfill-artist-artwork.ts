"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";
import { normalizeEntityKey } from "@/lib/entity-normalize";
import { patchUserStreamArtistArt } from "@/lib/firestore/streams";
import { isUsableArtUrl } from "@/lib/stats-compute";
import type { Stream } from "@/lib/types/stream";

const RESOLVE_BATCH = 10;

export type ArtistArtBackfillProgress = {
  message: string;
  resolvedArtists: number;
  totalArtists: number;
  updatedStreams: number;
};

export type ArtistArtBackfillResult = {
  uniqueArtists: number;
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

/**
 * Resolve dedicated artist images for streams missing usable artistArt,
 * write to Firestore, and return the patched stream list.
 */
export async function backfillArtistArtwork(
  uid: string,
  streams: Stream[],
  onProgress?: (progress: ArtistArtBackfillProgress) => void
): Promise<{ result: ArtistArtBackfillResult; streams: Stream[] }> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user || user.uid !== uid) {
    throw new Error("Sign in to backfill artist artwork.");
  }

  const missingByKey = new Map<string, string>();
  for (const stream of streams) {
    if (isUsableArtUrl(stream.artistArt)) continue;
    const key = normalizeEntityKey(stream.artistName);
    if (!key || missingByKey.has(key)) continue;
    missingByKey.set(key, stream.artistName);
  }

  const list = [...missingByKey.values()];
  if (list.length === 0) {
    return {
      result: {
        uniqueArtists: 0,
        foundArt: 0,
        updatedStreams: 0,
        skipped: true,
        message: "Every loaded artist already has artwork.",
      },
      streams,
    };
  }

  const artByKey = new Map<string, string>();
  const token = await user.getIdToken(true);
  let foundArt = 0;

  onProgress?.({
    message: `Looking up ${list.length.toLocaleString()} artists…`,
    resolvedArtists: 0,
    totalArtists: list.length,
    updatedStreams: 0,
  });

  for (let i = 0; i < list.length; i += RESOLVE_BATCH) {
    const batch = list.slice(i, i + RESOLVE_BATCH);
    const response = await fetch("/api/resolve-artist-art", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ artists: batch }),
    });
    const data = (await response.json()) as ResolveResponse;
    if (!response.ok) {
      throw new Error(data.detail ?? data.error ?? "Could not resolve artist artwork.");
    }

    for (const [artistName, art] of Object.entries(data.arts ?? {})) {
      if (!isUsableArtUrl(art)) continue;
      artByKey.set(normalizeEntityKey(artistName), art);
      foundArt += 1;
    }

    onProgress?.({
      message: `Checked ${Math.min(i + batch.length, list.length).toLocaleString()} / ${list.length.toLocaleString()} artists…`,
      resolvedArtists: Math.min(i + batch.length, list.length),
      totalArtists: list.length,
      updatedStreams: 0,
    });
  }

  const patches: Array<{ id: string; artistArt: string }> = [];
  const nextStreams = streams.map((stream) => {
    if (isUsableArtUrl(stream.artistArt)) return stream;
    const art = artByKey.get(normalizeEntityKey(stream.artistName));
    if (!art) return stream;
    patches.push({ id: stream.id, artistArt: art });
    return {
      ...stream,
      artistArt: art,
      updatedAt: new Date(),
    };
  });

  onProgress?.({
    message: `Saving artwork on ${patches.length.toLocaleString()} plays…`,
    resolvedArtists: list.length,
    totalArtists: list.length,
    updatedStreams: 0,
  });

  const updatedStreams = await patchUserStreamArtistArt(uid, patches);

  return {
    result: {
      uniqueArtists: list.length,
      foundArt,
      updatedStreams,
      skipped: false,
      message:
        updatedStreams > 0
          ? `Updated ${updatedStreams.toLocaleString()} plays (${foundArt.toLocaleString()} of ${list.length.toLocaleString()} artists found)`
          : foundArt === 0
            ? `No artwork found for ${list.length.toLocaleString()} artists`
            : "Artwork already up to date",
    },
    streams: nextStreams,
  };
}
