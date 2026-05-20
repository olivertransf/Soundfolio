import { db, mongoDb } from "@/lib/db";
import { resolveAlbumArt } from "@/lib/resolve-art";

export type MissingAlbumArtGroup = {
  trackId: string;
  trackName: string;
  artistName: string;
  albumName: string;
};

/** Tracks missing art, newest plays first (so fresh scrobbles get filled). */
export async function listMissingAlbumArtGroups(
  limit: number
): Promise<MissingAlbumArtGroup[]> {
  const col = (await mongoDb()).collection("streams");
  const rows = await col
    .aggregate<{
      _id: {
        trackId: string;
        trackName: string;
        artistName: string;
        albumName: string;
      };
    }>([
      { $match: { isDemo: false, albumArt: null } },
      {
        $group: {
          _id: {
            trackId: "$trackId",
            trackName: "$trackName",
            artistName: "$artistName",
            albumName: "$albumName",
          },
          lastPlayed: { $max: "$playedAt" },
        },
      },
      { $sort: { lastPlayed: -1 } },
      { $limit: limit },
    ])
    .toArray();

  return rows.map((r) => ({
    trackId: r._id.trackId,
    trackName: r._id.trackName,
    artistName: r._id.artistName,
    albumName: r._id.albumName,
  }));
}

export async function countMissingAlbumArtGroups(): Promise<number> {
  const col = (await mongoDb()).collection("streams");
  const rows = await col
    .aggregate<{ n: number }>([
      { $match: { isDemo: false, albumArt: null } },
      {
        $group: {
          _id: {
            trackId: "$trackId",
            trackName: "$trackName",
            artistName: "$artistName",
            albumName: "$albumName",
          },
        },
      },
      { $count: "n" },
    ])
    .toArray();
  return rows[0]?.n ?? 0;
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
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }

  const totalMissing = await countMissingAlbumArtGroups();
  return {
    updated,
    processed: groups.length,
    remaining: Math.max(0, totalMissing),
  };
}
