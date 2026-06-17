import { db } from "@/lib/db";
import { resolveAlbumArt } from "@/lib/resolve-art";

export type MissingAlbumArtGroup = {
  trackId: string;
  trackName: string;
  artistName: string;
  albumName: string;
};

function groupMissingAlbumArt(limit: number) {
  const groups = new Map<string, MissingAlbumArtGroup & { lastPlayed: number }>();

  return db.stream
    .findMany({ where: { isDemo: false, albumArt: null } })
    .then((rows) => {
      for (const row of rows) {
        const key = `${row.trackId}\u0000${row.trackName}\u0000${row.artistName}\u0000${row.albumName}`;
        const playedAt = row.playedAt.getTime();
        const existing = groups.get(key);
        if (!existing || playedAt > existing.lastPlayed) {
          groups.set(key, {
            trackId: row.trackId,
            trackName: row.trackName,
            artistName: row.artistName,
            albumName: row.albumName,
            lastPlayed: playedAt,
          });
        }
      }

      return [...groups.values()]
        .sort((a, b) => b.lastPlayed - a.lastPlayed)
        .slice(0, limit)
        .map(({ trackId, trackName, artistName, albumName }) => ({
          trackId,
          trackName,
          artistName,
          albumName,
        }));
    });
}

/** Tracks missing art, newest plays first (so fresh scrobbles get filled). */
export async function listMissingAlbumArtGroups(limit: number): Promise<MissingAlbumArtGroup[]> {
  return groupMissingAlbumArt(limit);
}

export async function countMissingAlbumArtGroups(): Promise<number> {
  const rows = await db.stream.findMany({ where: { isDemo: false, albumArt: null } });
  const groups = new Set<string>();
  for (const row of rows) {
    groups.add(`${row.trackId}\u0000${row.trackName}\u0000${row.artistName}\u0000${row.albumName}`);
  }
  return groups.size;
}

export async function backfillAlbumArtBatch(limit: number, delayMs: number) {
  const groups = await listMissingAlbumArtGroups(limit);
  let updated = 0;

  for (const m of groups) {
    const art = await resolveAlbumArt(m);
    if (art) {
      const result = await db.stream.updateMany({
        where: { trackId: m.trackId, albumArt: null },
        data: { albumArt: art },
      });
      updated += result.count;
    }
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  const remaining = await countMissingAlbumArtGroups();
  return {
    updated,
    processed: groups.length,
    remaining,
  };
}
