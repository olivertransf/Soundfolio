/**
 * What still lands in early-morning hour buckets (LA)?
 *
 * Usage: MONGODB_URI=... npx tsx scripts/diagnose-3am.ts
 */
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto as Crypto;

import "dotenv/config";
import { mongoDb } from "../lib/db";
import {
  getHourInTimeZone,
  getListenBucketInstant,
  startOfYearInZone,
} from "../lib/stats-timezone";

const tz = "America/Los_Angeles";

async function main() {
  const since = startOfYearInZone(new Date(), tz);
  const col = (await mongoDb()).collection("streams");
  const rows = await col
    .find({ isDemo: false, playedAt: { $gte: since }, durationMs: { $gt: 0 } })
    .project({ playedAt: 1, durationMs: 1, trackId: 1, artistName: 1, trackName: 1 })
    .toArray();

  const earlyHours = [0, 1, 2, 3, 4, 5];
  const bySource: Record<string, number> = { lfm: 0, spotifyApi: 0, spotifyImport: 0 };
  const samples: string[] = [];

  for (const r of rows) {
    const playedAt = new Date(r.playedAt);
    const trackId = String(r.trackId);
    if (trackId.startsWith("lfm-")) continue;
    const instant = getListenBucketInstant(playedAt, Number(r.durationMs), trackId, tz);
    const h = getHourInTimeZone(instant, tz);
    if (!earlyHours.includes(h)) continue;

    if (trackId.startsWith("lfm-")) bySource.lfm++;
    else if (playedAt.getUTCMilliseconds() !== 0) bySource.spotifyApi++;
    else bySource.spotifyImport++;

    if (samples.length < 12) {
      const playedH = getHourInTimeZone(playedAt, tz);
      samples.push(
        `bucket h${h} played h${playedH} ${playedAt.toISOString().slice(0, 19)}Z ` +
          `${r.artistName} – ${r.trackName} (${trackId.slice(0, 14)})`
      );
    }
  }

  const total = Object.values(bySource).reduce((a, b) => a + b, 0);
  console.log("YTD early-morning bucket plays (0-5h LA, Spotify only):", total);
  console.log("By source:", bySource);
  console.log("\nSamples:");
  for (const s of samples) console.log(" ", s);

  const hourCounts = Array.from({ length: 24 }, () => 0);
  for (const r of rows) {
    const trackId = String(r.trackId);
    if (trackId.startsWith("lfm-")) continue;
    const instant = getListenBucketInstant(
      new Date(r.playedAt),
      Number(r.durationMs),
      trackId,
      tz
    );
    hourCounts[getHourInTimeZone(instant, tz)]++;
  }
  console.log("\n(Spotify-only bucket distribution)");
  console.log("\nFull bucket distribution (top):");
  console.log(
    hourCounts
      .map((c, h) => [h, c] as const)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
