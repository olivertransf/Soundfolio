"use client";

import { DEV_LASTFM_USERNAME } from "@/lib/dev-lastfm-user";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { getUserProfile } from "@/lib/firestore/user-profile";
import { writeUserStreams } from "@/lib/firestore/streams";
import type { Stream } from "@/lib/types/stream";
import { scrobbleIdentityKey } from "@/lib/stream-ids";
import { CROSS_SOURCE_WINDOW_MS } from "@/lib/listen-dedupe";

type SyncResponse = {
  synced?: number;
  hasMore?: boolean;
  pending?: number;
  totalNovel?: number;
  skipped?: boolean;
  message?: string;
  detail?: string;
  durations?: Record<string, number>;
  persisted?: boolean;
  uid?: string;
  streams?: Array<{
    trackId: string;
    trackName: string;
    artistName: string;
    artistArt: string | null;
    albumName: string;
    albumArt: string | null;
    durationMs: number;
    playedAt: string;
    isDemo: boolean;
  }>;
};

const SYNC_OVERLAP_MS = 2 * 60 * 60 * 1000 + CROSS_SOURCE_WINDOW_MS;

function existingPayload(streams: Stream[]) {
  const latest = streams.reduce((max, stream) => Math.max(max, stream.playedAt.getTime()), 0);
  const windowStart = latest > 0 ? latest - SYNC_OVERLAP_MS : 0;
  return streams
    .filter((stream) => latest === 0 || stream.playedAt.getTime() >= windowStart)
    .map((stream) => ({
      artistName: stream.artistName,
      trackName: stream.trackName,
      playedAt: stream.playedAt.toISOString(),
      trackId: stream.trackId,
      artistArt: stream.artistArt,
    }));
}

export type SyncProgress = {
  message: string;
  importedCount: number;
  pendingCount?: number;
  totalNovel?: number;
};

export type SyncOutcome = {
  written: number;
  message: string;
  kind: "added" | "upToDate" | "skipped" | "failed";
};

export async function runLastFmSync(
  uid: string,
  streams: Stream[],
  onProgress?: (progress: SyncProgress) => void
): Promise<SyncOutcome> {
  const devSync = process.env.NODE_ENV === "development";
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!devSync && (!user || user.uid !== uid)) {
    throw new Error("Sign in to sync Last.fm.");
  }

  const profile = user ? await getUserProfile(user.uid) : null;
  const lastfmUsername = devSync
    ? DEV_LASTFM_USERNAME
    : profile?.lastfmUsername?.trim();
  if (!lastfmUsername) {
    throw new Error("Add your Last.fm username in onboarding.");
  }

  const latestMs = streams.reduce((max, stream) => Math.max(max, stream.playedAt.getTime()), 0);
  const latestPlayedAt = latestMs > 0 ? new Date(latestMs).toISOString() : null;
  const token = user ? await user.getIdToken(true) : null;
  let totalWritten = 0;
  let sessionTotal = 0;
  const knownDurations: Record<string, number> = {};

  onProgress?.({ message: "Connecting to Last.fm…", importedCount: 0, totalNovel: 0 });

  for (let batch = 0; batch < 40; batch++) {
    onProgress?.({
      message:
        batch === 0
          ? "Fetching scrobbles from Last.fm…"
          : `Importing scrobbles (${totalWritten} saved)…`,
      importedCount: totalWritten,
      pendingCount: Math.max(0, sessionTotal - totalWritten),
      totalNovel: sessionTotal,
    });
    const response = await fetch("/api/sync-lastfm", {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lastfmUsername,
        latestPlayedAt,
        existing: existingPayload(streams),
        knownDurations,
      }),
    });

    const data = (await response.json()) as SyncResponse;
    if (!response.ok) {
      throw new Error(data.detail ?? data.message ?? "Last.fm sync failed.");
    }
    if (data.skipped) {
      const message = data.detail ?? data.message ?? "Sync skipped.";
      return { written: totalWritten, message, kind: "skipped" };
    }

    if (data.durations) {
      Object.assign(knownDurations, data.durations);
    }
    if (sessionTotal === 0 && typeof data.totalNovel === "number") {
      sessionTotal = data.totalNovel + totalWritten;
    }

    const incoming = (data.streams ?? []).map((stream) => ({
      ...stream,
      playedAt: new Date(stream.playedAt),
    }));
    if (incoming.length === 0) break;

    onProgress?.({
      message: `Saving ${incoming.length} scrobbles…`,
      importedCount: totalWritten,
      pendingCount: data.pending,
      totalNovel: sessionTotal,
    });

    const ownerUid = data.uid ?? uid;
    const written = data.persisted ? incoming.length : await writeUserStreams(ownerUid, incoming, true);
    totalWritten += written;

    if (data.pending && data.pending > 0 && data.hasMore) {
      onProgress?.({
        message: `Saved ${totalWritten} · ${data.pending} remaining`,
        importedCount: totalWritten,
        pendingCount: data.pending,
        totalNovel: sessionTotal,
      });
    } else if (written > 0) {
      onProgress?.({
        message: `Saved ${totalWritten} scrobbles`,
        importedCount: totalWritten,
        pendingCount: 0,
        totalNovel: sessionTotal || totalWritten,
      });
    }

    for (const stream of incoming) {
      streams.unshift({
        id: `${ownerUid}__${stream.trackId}__${stream.playedAt.getTime()}`,
        trackId: stream.trackId,
        trackName: stream.trackName,
        artistName: stream.artistName,
        artistArt: stream.artistArt,
        albumName: stream.albumName,
        albumArt: stream.albumArt,
        durationMs: stream.durationMs,
        playedAt: stream.playedAt,
        isDemo: false,
        createdAt: stream.playedAt,
        updatedAt: stream.playedAt,
      });
    }

    if (!data.hasMore || written === 0) break;
  }

  if (totalWritten > 0) {
    return {
      written: totalWritten,
      message: `Added ${totalWritten} scrobbles`,
      kind: "added",
    };
  }
  return { written: 0, message: "Already up to date", kind: "upToDate" };
}

export function dedupeStreamKeys(streams: Stream[]) {
  return new Set(
    streams.map((stream) =>
      scrobbleIdentityKey(stream.artistName, stream.trackName, stream.playedAt)
    )
  );
}
