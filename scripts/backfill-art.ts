/**
 * Backfill album art for streams missing artwork (newest plays first).
 *
 * Usage: npx tsx scripts/backfill-art.ts
 */

import "dotenv/config";
import { db } from "../lib/db";
import { backfillAlbumArtBatch, countMissingAlbumArtGroups } from "../lib/backfill-art-queue";

const MAX_PER_RUN = 500;
const DELAY_MS = 350;

async function main() {
  const total = await countMissingAlbumArtGroups();
  if (total === 0) {
    console.log("No tracks missing album artwork.");
    process.exit(0);
  }

  console.log(`Processing up to ${MAX_PER_RUN} of ${total} track groups (newest first)...`);
  const { updated, processed, remaining } = await backfillAlbumArtBatch(MAX_PER_RUN, DELAY_MS);
  console.log(`Updated ${updated} streams (${processed} groups). ${remaining} groups still missing art.`);
}

main()
  .catch((err) => {
    console.error("Backfill error:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
