/**
 * Recompute Last.fm listen durations: full track length unless the next
 * scrobble (any source) happens sooner.
 *
 * Usage: MONGODB_URI=... npx tsx scripts/recompute-lastfm-listen-duration.ts
 */
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto as Crypto;

import "dotenv/config";
import type { Document, Filter } from "mongodb";
import { db, mongoDb } from "../lib/db";
import {
  isLastFmStream,
  recomputeLastFmListenDurations,
  type LastFmTimelineRow,
} from "../lib/lastfm-listen-duration";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const col = (await mongoDb()).collection("streams");
  const rows = await col
    .find({ isDemo: false })
    .project({
      _id: 1,
      trackId: 1,
      artistName: 1,
      trackName: 1,
      playedAt: 1,
      durationMs: 1,
    })
    .sort({ playedAt: 1 })
    .toArray();

  const timeline: LastFmTimelineRow[] = rows.map((r) => ({
    id: r._id,
    trackId: r.trackId,
    artistName: r.artistName,
    trackName: r.trackName,
    playedAt: r.playedAt,
    durationMs: r.durationMs,
  }));

  const updates = await recomputeLastFmListenDurations(timeline);
  const lfmCount = timeline.filter((r) => isLastFmStream(r.trackId)).length;

  console.log(
    dryRun ? "[dry-run] " : "",
    `${updates.size} of ${lfmCount} Last.fm rows need new listen durations.`
  );

  if (dryRun || updates.size === 0) return;

  let modified = 0;
  for (const [id, durationMs] of updates) {
    const result = await col.updateOne(
      { _id: id } as unknown as Filter<Document>,
      { $set: { durationMs, updatedAt: new Date() } }
    );
    if (result.modifiedCount) modified++;
  }
  console.log(`Updated ${modified} rows.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
