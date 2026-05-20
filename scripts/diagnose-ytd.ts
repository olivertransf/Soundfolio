import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto as Crypto;

import "dotenv/config";
import { mongoDb } from "../lib/db";
import { startOfYearInZone, getStatsTimeZone } from "../lib/stats-timezone";

async function main() {
  const col = (await mongoDb()).collection("streams");
  const tz = getStatsTimeZone();
  const since = startOfYearInZone(new Date(), tz);

  const [agg] = await col
    .aggregate([
      { $match: { isDemo: false, playedAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          plays: { $sum: 1 },
          totalMs: { $sum: "$durationMs" },
          over4m: { $sum: { $cond: [{ $gt: ["$durationMs", 240000] }, 1, 0] } },
          over3m: { $sum: { $cond: [{ $gt: ["$durationMs", 180000] }, 1, 0] } },
        },
      },
    ])
    .toArray();

  const plays = agg?.plays ?? 0;
  const minutes = Math.round((agg?.totalMs ?? 0) / 60000);
  console.log(`YTD (${tz}) since ${since.toISOString().slice(0, 10)}`);
  console.log(`  ${plays} plays, ${minutes} min total`);
  console.log(`  If 3m/scrobble: ${plays * 3} min`);
  console.log(`  If 2m/scrobble: ${plays * 2} min`);
  console.log(`  Rows >3min: ${agg?.over3m ?? 0}, >4min: ${agg?.over4m ?? 0}`);

  const bad = await col
    .find({ isDemo: false, playedAt: { $gte: since }, durationMs: { $gt: 180000 } })
    .project({ artistName: 1, trackName: 1, durationMs: 1, playedAt: 1, trackId: 1 })
    .limit(10)
    .toArray();
  if (bad.length) {
    console.log("\nRows still >3min:");
    for (const r of bad) {
      console.log(
        `  ${Math.round(r.durationMs / 60000)}m ${r.artistName} - ${r.trackName} (${r.trackId})`
      );
    }
  }
}

main();
