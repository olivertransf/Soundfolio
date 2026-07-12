"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";
import { patchUserStreamDurations } from "@/lib/firestore/streams";
import type { Stream } from "@/lib/types/stream";

const RESOLVE_BATCH = 40;
const FALLBACK_DURATION_MS = 180_000;

export type DurationBackfillProgress = {
  message: string;
  resolvedTracks: number;
  totalTracks: number;
  updatedStreams: number;
};

export type DurationBackfillResult = {
  uniqueTracks: number;
  updatedStreams: number;
  skipped: boolean;
  message: string;
};

type ResolveResponse = {
  durations?: Record<string, number>;
  error?: string;
  detail?: string;
};

function isLastFmStream(stream: Stream) {
  return stream.trackId.startsWith("lfm-");
}

function trackKey(artistName: string, trackName: string) {
  return `${artistName}\0${trackName}`;
}

/**
 * Resolve Last.fm catalog lengths for every unique Last.fm track in memory,
 * write corrected durationMs to Firestore, and return patched stream list.
 */
export async function backfillLastFmCatalogDurations(
  uid: string,
  streams: Stream[],
  onProgress?: (progress: DurationBackfillProgress) => void
): Promise<{ result: DurationBackfillResult; streams: Stream[] }> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user || user.uid !== uid) {
    throw new Error("Sign in to fix song lengths.");
  }

  const lastFmRows = streams.filter(isLastFmStream);
  if (lastFmRows.length === 0) {
    return {
      result: {
        uniqueTracks: 0,
        updatedStreams: 0,
        skipped: true,
        message: "No Last.fm plays loaded.",
      },
      streams,
    };
  }

  const unique = new Map<string, { artist: string; track: string }>();
  for (const row of lastFmRows) {
    const key = trackKey(row.artistName, row.trackName);
    if (!unique.has(key)) {
      unique.set(key, { artist: row.artistName, track: row.trackName });
    }
  }

  const list = [...unique.values()];
  const durationByKey = new Map<string, number>();
  const token = await user.getIdToken(true);

  onProgress?.({
    message: `Resolving ${list.length.toLocaleString()} tracks…`,
    resolvedTracks: 0,
    totalTracks: list.length,
    updatedStreams: 0,
  });

  for (let i = 0; i < list.length; i += RESOLVE_BATCH) {
    const batch = list.slice(i, i + RESOLVE_BATCH);
    const response = await fetch("/api/resolve-track-durations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tracks: batch }),
    });
    const data = (await response.json()) as ResolveResponse;
    if (!response.ok) {
      throw new Error(data.detail ?? data.error ?? "Could not resolve track lengths.");
    }

    for (const [key, ms] of Object.entries(data.durations ?? {})) {
      durationByKey.set(key, ms);
    }

    onProgress?.({
      message: `Resolved ${Math.min(i + batch.length, list.length).toLocaleString()} / ${list.length.toLocaleString()} tracks…`,
      resolvedTracks: Math.min(i + batch.length, list.length),
      totalTracks: list.length,
      updatedStreams: 0,
    });
  }

  const patches: Array<{ id: string; durationMs: number }> = [];
  const nextStreams = streams.map((stream) => {
    if (!isLastFmStream(stream)) return stream;
    const key = trackKey(stream.artistName, stream.trackName);
    const durationMs = durationByKey.get(key) ?? FALLBACK_DURATION_MS;
    if (stream.durationMs === durationMs) return stream;
    patches.push({ id: stream.id, durationMs });
    return {
      ...stream,
      durationMs,
      updatedAt: new Date(),
    };
  });

  onProgress?.({
    message: `Saving ${patches.length.toLocaleString()} plays…`,
    resolvedTracks: list.length,
    totalTracks: list.length,
    updatedStreams: 0,
  });

  const updatedStreams = await patchUserStreamDurations(uid, patches);

  return {
    result: {
      uniqueTracks: list.length,
      updatedStreams,
      skipped: false,
      message:
        updatedStreams > 0
          ? `Updated ${updatedStreams.toLocaleString()} plays across ${list.length.toLocaleString()} tracks`
          : `Lengths already correct (${list.length.toLocaleString()} tracks)`,
    },
    streams: nextStreams,
  };
}
