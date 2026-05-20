/**
 * Fix Last.fm rows where scrobble time used local wall digits as UTC (~2–6 AM ghost plays).
 *
 * Usage: MONGODB_URI=... npx tsx scripts/fix-lastfm-played-at.ts [--dry-run] [America/Los_Angeles]
 */
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto as Crypto;

import "dotenv/config";
import type { Document, Filter } from "mongodb";
import { db, mongoDb } from "../lib/db";
import {
  correctLastFmPlayedAt,
  getHourInTimeZone,
  lastFmLooksWallTimeAsUtc,
  resolveStatsTimeZone,
} from "../lib/stats-timezone";
import { lastFmScrobbleStreamId } from "../lib/stream-ids";

const dryRun = process.argv.includes("--dry-run");
const tzArg = process.argv.find((a) => a.includes("/"));
const timeZone = resolveStatsTimeZone(tzArg);

async function main() {
  const col = (await mongoDb()).collection("streams");
  const rows = await col
    .find({ isDemo: false, trackId: { $regex: "^lfm-" } })
    .project({
      _id: 1,
      trackId: 1,
      artistName: 1,
      trackName: 1,
      playedAt: 1,
    })
    .toArray();

  let candidates = 0;
  let modified = 0;

  for (const row of rows) {
    const playedAt = new Date(row.playedAt);
    if (!lastFmLooksWallTimeAsUtc(playedAt, timeZone)) continue;

    candidates++;
    const fixed = correctLastFmPlayedAt(playedAt, timeZone);
    if (fixed.getTime() === playedAt.getTime()) continue;

    const trackId = lastFmScrobbleStreamId(row.artistName, row.trackName, fixed);

    if (dryRun) {
      if (modified < 8) {
        const beforeH = getHourInTimeZone(playedAt, timeZone);
        const afterH = getHourInTimeZone(fixed, timeZone);
        console.log(
          `${playedAt.toISOString()} h${beforeH} -> ${fixed.toISOString()} h${afterH} ${row.artistName}`
        );
      }
      modified++;
      continue;
    }

    const result = await col.updateOne(
      { _id: row._id } as unknown as Filter<Document>,
      { $set: { playedAt: fixed, trackId, updatedAt: new Date() } }
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
