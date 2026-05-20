import { db } from "@/lib/db";
import {
  shouldIgnoreLastFmScrobble,
  recomputeLastFmListenDurations,
  type LastFmTimelineRow,
} from "@/lib/lastfm-listen-duration";
import { resolveLastFmCatalogDurationMs } from "@/lib/lastfm";
import { resolveAlbumArt, resolveArtistArt } from "@/lib/resolve-art";
import { lastFmScrobbleStreamId, scrobbleIdentityKey } from "@/lib/stream-ids";

export type IncomingScrobble = {
  artist: string;
  name: string;
  album: string;
  playedAt: Date;
  image: string | null;
};

export async function filterInsertableLastFmScrobbles(
  novel: IncomingScrobble[]
): Promise<IncomingScrobble[]> {
  if (novel.length === 0) return [];

  const sorted = [...novel].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  const minPlayed = sorted[0].playedAt;
  const maxPlayed = sorted[sorted.length - 1].playedAt;

  const [neighborBefore, inRange, neighborAfter] = await Promise.all([
    db.stream.findFirst({
      where: { isDemo: false, playedAt: { lt: minPlayed } },
      orderBy: { playedAt: "desc" },
      select: { playedAt: true },
    }),
    db.stream.findMany({
      where: { isDemo: false, playedAt: { gte: minPlayed, lte: maxPlayed } },
      orderBy: { playedAt: "asc" },
      select: { playedAt: true },
    }),
    db.stream.findFirst({
      where: { isDemo: false, playedAt: { gt: maxPlayed } },
      orderBy: { playedAt: "asc" },
      select: { playedAt: true },
    }),
  ]);

  type TimelinePoint =
    | { kind: "db"; playedAt: Date }
    | { kind: "novel"; playedAt: Date; scrobble: IncomingScrobble };

  const timeline: TimelinePoint[] = [];
  if (neighborBefore) timeline.push({ kind: "db", playedAt: neighborBefore.playedAt });
  for (const row of inRange) timeline.push({ kind: "db", playedAt: row.playedAt });
  for (const scrobble of sorted) {
    timeline.push({ kind: "novel", playedAt: scrobble.playedAt, scrobble });
  }
  if (neighborAfter) timeline.push({ kind: "db", playedAt: neighborAfter.playedAt });
  timeline.sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());

  return sorted.filter((scrobble) => {
    const idx = timeline.findIndex((p) => p.kind === "novel" && p.scrobble === scrobble);
    const next = timeline[idx + 1]?.playedAt;
    return !shouldIgnoreLastFmScrobble(scrobble.playedAt, next);
  });
}

export async function insertLastFmScrobbles(novel: IncomingScrobble[]) {
  if (novel.length === 0) {
    return { inserted: 0, durationUpdates: 0, ignored: 0 };
  }

  const insertable = await filterInsertableLastFmScrobbles(novel);
  if (insertable.length === 0) {
    return { inserted: 0, durationUpdates: 0, ignored: novel.length };
  }

  const sorted = [...insertable].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  const minPlayed = sorted[0].playedAt;
  const maxPlayed = sorted[sorted.length - 1].playedAt;

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

  return {
    inserted: insertResult.count,
    durationUpdates,
    ignored: novel.length - insertable.length,
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

  const { updates, deleteIds } = await recomputeLastFmListenDurations(timeline);
  if (deleteIds.length > 0) {
    await db.stream.deleteMany({ where: { id: { in: deleteIds } } });
  }
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
