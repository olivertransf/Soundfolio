/**
 * Inserts synthetic demo streams into MongoDB (`isDemo: true`).
 * Run after `npm run db:indexes`.
 *
 *   npx tsx scripts/seed-demo.ts
 */

import "dotenv/config";
import { db } from "../lib/db";
import { getDemoStreams } from "../lib/demo-seed";

const BATCH = 500;

async function main() {
  const deleted = await db.stream.deleteMany({ where: { isDemo: true } });
  console.log(`Removed ${deleted.count} existing demo rows.`);

  const streams = getDemoStreams();
  let inserted = 0;
  for (let i = 0; i < streams.length; i += BATCH) {
    const chunk = streams.slice(i, i + BATCH);
    const result = await db.stream.createMany({
      data: chunk.map((s) => ({
        trackId: s.trackId,
        trackName: s.trackName,
        artistName: s.artistName,
        artistArt: s.artistArt,
        albumName: s.albumName,
        albumArt: s.albumArt,
        durationMs: s.durationMs,
        playedAt: s.playedAt,
        isDemo: true,
      })),
    });
    inserted += result.count;
  }

  console.log(`Inserted ${inserted} demo streams (${streams.length} generated).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
