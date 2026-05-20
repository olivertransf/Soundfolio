/**
 * Backfill album art for streams missing artwork.
 * Tries Last.fm (scrobble / track / album) → iTunes → Cover Art Archive.
 *
 * Usage: npx tsx scripts/backfill-art.ts
 */

import "dotenv/config";
import { db } from "../lib/db";
import { resolveAlbumArt } from "../lib/resolve-art";

const MAX_PER_RUN = 500;
const DELAY_MS = 350;

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
