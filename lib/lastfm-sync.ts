import { db } from "@/lib/db";
import {
  recomputeLastFmListenDurations,
  type LastFmTimelineRow,
} from "@/lib/lastfm-listen-duration";
import {
  isLastFmPlaceholderUrl,
  lastFmDefaultDurationMs,
  resolveLastFmCatalogDurationMs,
} from "@/lib/lastfm";
import { backfillAlbumArtBatch } from "@/lib/backfill-art-queue";
import { resolveAlbumArt, resolveArtistArt } from "@/lib/resolve-art";
import { lastFmScrobbleStreamId, scrobbleIdentityKey } from "@/lib/stream-ids";
import { correctLastFmPlayedAt, resolveStatsTimeZone } from "@/lib/stats-timezone";

export type IncomingScrobble = {
  artist: string;
  name: string;
  album: string;
  playedAt: Date;
  image: string | null;
};

export type InsertLastFmOptions = {
  /** Skip per-track Last.fm/iTunes art lookups (safe for serverless sync). */
  fast?: boolean;
};

export async function insertLastFmScrobbles(
  novel: IncomingScrobble[],
  timeZone?: string,
  options?: InsertLastFmOptions
) {
  if (novel.length === 0) {
    return { inserted: 0, durationUpdates: 0, artUpdated: 0 };
  }

  const tz = resolveStatsTimeZone(timeZone);
  const normalized = novel.map((t) => {
    const playedAt = correctLastFmPlayedAt(t.playedAt, tz);
    return { ...t, playedAt };
  });

  const sorted = [...normalized].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  const minPlayed = sorted[0].playedAt;
  const maxPlayed = sorted[sorted.length - 1].playedAt;

  const fast = options?.fast === true;
  const defaultDurationMs = lastFmDefaultDurationMs();
  const catalogCache = new Map<string, number>();
  const artistArtCache = new Map<string, string | null>();
  const insertData = sorted.map((t) => ({
    trackId: lastFmScrobbleStreamId(t.artist, t.name, t.playedAt),
    trackName: t.name,
    artistName: t.artist,
    artistArt: null as string | null,
    albumName: t.album,
    albumArt: null as string | null,
    durationMs: 0,
    playedAt: t.playedAt,
    isDemo: false as const,
    _scrobbleImage: t.image,
  }));

  for (const row of insertData) {
    if (fast) {
      row.durationMs = defaultDurationMs;
      const image = row._scrobbleImage;
      row.albumArt =
        image && !isLastFmPlaceholderUrl(image) ? image : null;
      row.artistArt = null;
      continue;
    }

    row.durationMs = await resolveLastFmCatalogDurationMs(
      row.artistName,
      row.trackName,
      catalogCache
    );
    row.albumArt = await resolveAlbumArt({
      artistName: row.artistName,
      trackName: row.trackName,
      albumName: row.albumName,
      scrobbleImage: row._scrobbleImage,
    });
    let artistArt = artistArtCache.get(row.artistName);
    if (artistArt === undefined) {
      artistArt = await resolveArtistArt(row.artistName);
      artistArtCache.set(row.artistName, artistArt);
    }
    row.artistArt = artistArt;
  }

  const rowsToInsert = insertData.map(({ _scrobbleImage: _, ...row }) => row);

  const insertResult = await db.stream.createMany({ data: rowsToInsert, skipDuplicates: true });
  const durationUpdates = await recomputeLastFmDurationsAround(minPlayed, maxPlayed);

  let artUpdated = 0;
  const needsArt = !fast && rowsToInsert.some((r) => !r.albumArt);
  if (needsArt && insertResult.count > 0) {
    const batch = await backfillAlbumArtBatch(Math.min(10, insertResult.count + 5), 200);
    artUpdated = batch.updated;
  }

  return {
    inserted: insertResult.count,
    durationUpdates,
    artUpdated,
  };
}

/** Recompute Last.fm listen times in a window (full catalog unless next play is sooner). */
export async function recomputeLastFmDurationsAround(minPlayed: Date, maxPlayed: Date) {
  const [neighborBefore, inRange, neighborAfter] = await Promise.all([
    db.stream.findFirst({
      where: { isDemo: false, playedAt: { lt: minPlayed } },
      orderBy: { playedAt: "desc" },
    }),
    db.stream.findMany({
      where: { isDemo: false, playedAt: { gte: minPlayed, lte: maxPlayed } },
      orderBy: { playedAt: "asc" },
    }),
    db.stream.findFirst({
      where: { isDemo: false, playedAt: { gt: maxPlayed } },
      orderBy: { playedAt: "asc" },
    }),
  ]);

  const timeline: LastFmTimelineRow[] = [];
  const seenIds = new Set<string>();
  for (const row of [neighborBefore, ...inRange, neighborAfter]) {
    if (!row || seenIds.has(row.id)) continue;
    seenIds.add(row.id);
    timeline.push({
      id: row.id,
      trackId: row.trackId,
      artistName: row.artistName,
      trackName: row.trackName,
      playedAt: row.playedAt,
      durationMs: row.durationMs,
    });
  }

  const { updates } = await recomputeLastFmListenDurations(timeline);
  let durationUpdates = 0;
  for (const [id, durationMs] of updates) {
    await db.stream.updateMany({ where: { id }, data: { durationMs } });
    durationUpdates++;
  }
  return durationUpdates;
}

export function filterNovelScrobbles(
  tracks: IncomingScrobble[],
  existing: { artistName: string; trackName: string; playedAt: Date }[]
) {
  const seen = new Set(
    existing.map((row) => scrobbleIdentityKey(row.artistName, row.trackName, row.playedAt))
  );
  return tracks.filter((t) => !seen.has(scrobbleIdentityKey(t.artist, t.name, t.playedAt)));
}

export async function loadExistingInPlayWindow(tracks: IncomingScrobble[]) {
  if (tracks.length === 0) return [];
  const playedAts = tracks.map((t) => t.playedAt);
  const minPlayed = new Date(Math.min(...playedAts.map((d) => d.getTime())));
  const maxPlayed = new Date(Math.max(...playedAts.map((d) => d.getTime())));
  return db.stream.findMany({
    where: { isDemo: false, playedAt: { gte: minPlayed, lte: maxPlayed } },
    select: { artistName: true, trackName: true, playedAt: true },
  });
}
