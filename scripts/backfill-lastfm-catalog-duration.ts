/**
 * Set durationMs on Last.fm rows to catalog track length (from track.getInfo).
 *
 * Usage: MONGODB_URI=... npx tsx scripts/backfill-lastfm-catalog-duration.ts
 * Add --dry-run to preview.
 */
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto as Crypto;

import "dotenv/config";
import type { Document, Filter } from "mongodb";
import { mongoDb } from "../lib/db";
import { resolveLastFmCatalogDurationMs } from "../lib/lastfm";

const dryRun = process.argv.includes("--dry-run");
const CONCURRENCY = 5;

async function main() {
  const col = (await mongoDb()).collection("streams");
  const rows = await col
    .find({ isDemo: false, trackId: /^lfm-/ })
    .project({ _id: 1, artistName: 1, trackName: 1, durationMs: 1 })
    .toArray();

  const unique = new Map<string, { artist: string; track: string }>();
  for (const row of rows) {
    const key = `${row.artistName}\0${row.trackName}`;
    if (!unique.has(key)) unique.set(key, { artist: row.artistName, track: row.trackName });
  }

  const durationCache = new Map<string, number>();
  const list = [...unique.values()];
  for (let i = 0; i < list.length; i += CONCURRENCY) {
    const batch = list.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(({ artist, track }) => resolveLastFmCatalogDurationMs(artist, track, durationCache))
    );
    if (i > 0 && i % 50 === 0) console.log(`Resolved ${i}/${list.length} tracks…`);
  }

  const writes: { _id: string; durationMs: number }[] = [];
  for (const row of rows) {
    const ms = durationCache.get(`${row.artistName}\0${row.trackName}`)!;
    if (row.durationMs !== ms) writes.push({ _id: row._id, durationMs: ms });
  }

  console.log(
    dryRun ? "[dry-run] " : "",
    `Would update ${writes.length} of ${rows.length} Last.fm rows (${list.length} unique tracks).`
  );

  if (dryRun || writes.length === 0) return;

  let updated = 0;
  for (let i = 0; i < writes.length; i += 200) {
    const chunk = writes.slice(i, i + 200);
    const ops = chunk.map((w) => ({
      updateOne: {
        filter: { _id: w._id } as unknown as Filter<Document>,
        update: { $set: { durationMs: w.durationMs, updatedAt: new Date() } },
      },
    }));
    const result = await col.bulkWrite(ops, { ordered: false });
    updated += result.modifiedCount;
  }
  console.log(`Updated ${updated} rows.`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
