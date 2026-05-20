import { db } from "@/lib/db";
import {
  isLastFmStream,
  recomputeLastFmListenDurations,
  type LastFmTimelineRow,
} from "@/lib/lastfm-listen-duration";
import { resolveLastFmCatalogDurationMs } from "@/lib/lastfm";
import { lastFmScrobbleStreamId, scrobbleIdentityKey } from "@/lib/stream-ids";

export type IncomingScrobble = {
  artist: string;
  name: string;
  album: string;
  playedAt: Date;
  image: string | null;
};

export async function insertLastFmScrobbles(novel: IncomingScrobble[]) {
  if (novel.length === 0) {
    return { inserted: 0, durationUpdates: 0 };
  }

  const sorted = [...novel].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  const minPlayed = sorted[0].playedAt;
  const maxPlayed = sorted[sorted.length - 1].playedAt;

  const catalogCache = new Map<string, number>();
  const insertData = sorted.map((t) => ({
    trackId: lastFmScrobbleStreamId(t.artist, t.name, t.playedAt),
    trackName: t.name,
    artistName: t.artist,
    artistArt: null,
    albumName: t.album,
    albumArt: t.image,
    durationMs: 0,
    playedAt: t.playedAt,
    isDemo: false as const,
  }));

  for (const row of insertData) {
    row.durationMs = await resolveLastFmCatalogDurationMs(
      row.artistName,
      row.trackName,
      catalogCache
    );
  }

  const insertResult = await db.stream.createMany({ data: insertData, skipDuplicates: true });
  const durationUpdates = await recomputeLastFmDurationsAround(minPlayed, maxPlayed);

  return { inserted: insertResult.count, durationUpdates };
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

  const updates = await recomputeLastFmListenDurations(timeline);
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
