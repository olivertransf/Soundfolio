"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";
import { getUserProfile } from "@/lib/firestore/user-profile";
import { writeUserStreams } from "@/lib/firestore/streams";
import type { Stream } from "@/lib/types/stream";
import { scrobbleIdentityKey } from "@/lib/stream-ids";

type SyncResponse = {
  synced?: number;
  hasMore?: boolean;
  pending?: number;
  skipped?: boolean;
  message?: string;
  detail?: string;
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

function existingPayload(streams: Stream[]) {
  return streams.map((stream) => ({
    artistName: stream.artistName,
    trackName: stream.trackName,
    playedAt: stream.playedAt.toISOString(),
    artistArt: stream.artistArt,
  }));
}

export type SyncProgress = {
  message: string;
  importedCount: number;
  pendingCount?: number;
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
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user || user.uid !== uid) {
    throw new Error("Sign in to sync Last.fm.");
  }

  const profile = await getUserProfile(uid);
  const lastfmUsername = profile?.lastfmUsername?.trim();
  if (!lastfmUsername) {
    throw new Error("Add your Last.fm username in onboarding.");
  }

  const latestPlayedAt = streams[0]?.playedAt?.toISOString() ?? null;
  const token = await user.getIdToken(true);
  let totalWritten = 0;

  onProgress?.({ message: "Connecting to Last.fm…", importedCount: 0 });

  for (let batch = 0; batch < 40; batch++) {
    onProgress?.({
      message:
        batch === 0
          ? "Fetching scrobbles from Last.fm…"
          : `Importing scrobbles (${totalWritten} saved)…`,
      importedCount: totalWritten,
    });
    const response = await fetch("/api/sync-lastfm", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lastfmUsername,
        latestPlayedAt,
        existing: existingPayload(streams),
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

    const incoming = (data.streams ?? []).map((stream) => ({
      ...stream,
      playedAt: new Date(stream.playedAt),
    }));
    if (incoming.length === 0) break;

    onProgress?.({
      message: `Saving ${incoming.length} scrobbles…`,
      importedCount: totalWritten,
    });

    const written = await writeUserStreams(uid, incoming, true);
    totalWritten += written;

    if (data.pending && data.pending > 0 && data.hasMore) {
      onProgress?.({
        message: `Saved ${totalWritten} · ${data.pending} remaining`,
        importedCount: totalWritten,
        pendingCount: data.pending,
      });
    } else if (written > 0) {
      onProgress?.({
        message: `Saved ${totalWritten} scrobbles`,
        importedCount: totalWritten,
        pendingCount: 0,
      });
    }

    for (const stream of incoming) {
      streams.unshift({
        id: `${uid}__${stream.trackId}__${stream.playedAt.getTime()}`,
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
