/**
 * Backfill album art for streams missing artwork.
 * Tries iTunes → Last.fm (if LASTFM_API_KEY) → Cover Art Archive.
 *
 * Usage: npx tsx scripts/backfill-art.ts
 */

import "dotenv/config";
import { db } from "../lib/db";
import { getAlbumArtFromItunes } from "../lib/itunes";
import { getAlbumArtFromCoverArtArchive } from "../lib/coverartarchive";
import { getTrackArt } from "../lib/lastfm";

const MAX_PER_RUN = 500;
const DELAY_MS = 350;

async function resolveAlbumArt(m: {
  trackName: string;
  artistName: string;
  albumName: string;
}): Promise<string | null> {
  let art: string | null = null;
  try {
    art = await getAlbumArtFromItunes(m.artistName, m.albumName);
  } catch {}
  if (!art && process.env.LASTFM_API_KEY) {
    try {
      art = await getTrackArt(m.artistName, m.trackName);
    } catch {}
  }
  if (!art) {
    try {
      art = await getAlbumArtFromCoverArtArchive(m.artistName, m.albumName);
    } catch {}
  }
  return art;
}

async function main() {
  const missing = await db.stream.groupBy({
    by: ["trackId", "trackName", "artistName", "albumName"],
    where: { albumArt: null },
  });

  if (missing.length === 0) {
    console.log("No tracks missing album artwork.");
    process.exit(0);
  }

  const toProcess = missing.slice(0, MAX_PER_RUN);
  const remaining = missing.length - toProcess.length;
  let updated = 0;

  console.log(`Processing ${toProcess.length} track groups (${remaining} more after this batch)...`);

  for (const m of toProcess) {
    const art = await resolveAlbumArt(m);
    if (art) {
      const result = await db.stream.updateMany({
        where: { trackId: m.trackId, albumArt: null },
        data: { albumArt: art },
      });
      updated += result.count;
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log(`Updated ${updated} streams. ${remaining} track groups remaining.`);
}

main()
  .catch((err) => {
    console.error("Backfill error:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
