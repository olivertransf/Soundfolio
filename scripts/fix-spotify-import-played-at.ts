/**
 * Fix Spotify ZIP rows where local wall time was stored as UTC (ms = 0, non-Last.fm).
 *
 * Usage: MONGODB_URI=... npx tsx scripts/fix-spotify-import-played-at.ts [--dry-run] [America/Los_Angeles]
 */
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto as Crypto;

import "dotenv/config";
import type { Document, Filter } from "mongodb";
import { db, mongoDb } from "../lib/db";
import {
  fixSpotifyImportPlayedAt,
  getHourInTimeZone,
  resolveStatsTimeZone,
} from "../lib/stats-timezone";

const dryRun = process.argv.includes("--dry-run");
const tzArg = process.argv.find((a) => a.includes("/"));
const timeZone = resolveStatsTimeZone(tzArg);

async function main() {
  const col = (await mongoDb()).collection("streams");
  const rows = await col
    .find({
      isDemo: false,
      trackId: { $not: { $regex: "^lfm-" } },
    })
    .project({ playedAt: 1, trackId: 1 })
    .toArray();

  let candidates = 0;
  let modified = 0;

  for (const row of rows) {
    const playedAt = new Date(row.playedAt);
    if (playedAt.getUTCMilliseconds() !== 0) continue;

    const h = getHourInTimeZone(playedAt, timeZone);
    if (!(h <= 6 || (h >= 14 && h <= 16))) continue;

    candidates++;
    const fixed = fixSpotifyImportPlayedAt(playedAt, timeZone);
    if (fixed.getTime() === playedAt.getTime()) continue;

    const beforeH = getHourInTimeZone(playedAt, timeZone);
    const afterH = getHourInTimeZone(fixed, timeZone);

    if (dryRun) {
      if (modified < 8) {
        console.log(
          `${playedAt.toISOString()} (h${beforeH}) -> ${fixed.toISOString()} (h${afterH})`
        );
      }
      modified++;
      continue;
    }

    const result = await col.updateOne(
      { _id: row._id } as unknown as Filter<Document>,
      { $set: { playedAt: fixed, updatedAt: new Date() } }
    );
    if (result.modifiedCount) modified++;
  }

  console.log(
    dryRun ? "[dry-run] " : "",
    `timezone=${timeZone} candidates=${candidates} ${dryRun ? "would update" : "updated"}=${modified}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
