import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto as Crypto;

import "dotenv/config";
import { mongoDb } from "../lib/db";
import { formatCalendarDateInZone, getStatsTimeZone } from "../lib/stats-timezone";

async function main() {
  const db = await mongoDb();
  const col = db.collection("streams");
  const tz = getStatsTimeZone();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const recent = await col
    .find({ isDemo: false, playedAt: { $gte: since } })
    .project({
      trackId: 1,
      trackName: 1,
      artistName: 1,
      playedAt: 1,
      durationMs: 1,
    })
    .toArray();

  const byDay: Record<string, { count: number; minutes: number; maxDurMin: number }> = {};
  const durBuckets = { under3m: 0, "3-10m": 0, "10-60m": 0, over60m: 0 };
  let legacyId = 0;
  let hashId = 0;
  let spotifyId = 0;

  for (const s of recent) {
    const day = formatCalendarDateInZone(s.playedAt, tz);
    if (!byDay[day]) byDay[day] = { count: 0, minutes: 0, maxDurMin: 0 };
    byDay[day].count++;
    const min = Math.round(s.durationMs / 60000);
    byDay[day].minutes += min;
    byDay[day].maxDurMin = Math.max(byDay[day].maxDurMin, min);

    const d = s.durationMs;
    if (d < 180_000) durBuckets.under3m++;
    else if (d < 600_000) durBuckets["3-10m"]++;
    else if (d < 3_600_000) durBuckets["10-60m"]++;
    else durBuckets.over60m++;

    if (/^lfm-\d+$/.test(s.trackId)) legacyId++;
    else if (s.trackId.startsWith("lfm-track-")) hashId++;
    else spotifyId++;
  }

  console.log("Timezone:", tz);
  console.log("\nMinutes by day (last 7d):");
  for (const [day, v] of Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  ${day}: ${v.count} plays, ${v.minutes.toLocaleString()} min (max single play ${v.maxDurMin} min)`);
  }

  console.log("\nDuration buckets (last 7d):", durBuckets);
  console.log("Track ID types:", { legacyId, hashId, spotifyId });

  const dupes = await col
    .aggregate([
      { $match: { isDemo: false, playedAt: { $gte: since } } },
      {
        $group: {
          _id: {
            artist: "$artistName",
            track: "$trackName",
            playedAt: "$playedAt",
          },
          n: { $sum: 1 },
          trackIds: { $addToSet: "$trackId" },
          totalMin: { $sum: { $divide: ["$durationMs", 60000] } },
        },
      },
      { $match: { n: { $gt: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 10 },
    ])
    .toArray();

  console.log(`\nDuplicate artist+track+playedAt groups: ${dupes.length} shown (top 10)`);
  for (const d of dupes) {
    console.log(
      `  n=${d.n} min≈${Math.round(d.totalMin)} ids=${(d.trackIds as string[]).join(", ")}`
    );
  }

  const topDur = await col
    .find({ isDemo: false, playedAt: { $gte: since } })
    .sort({ durationMs: -1 })
    .limit(5)
    .project({ trackName: 1, artistName: 1, durationMs: 1, playedAt: 1, trackId: 1 })
    .toArray();

  console.log("\nLongest plays (last 7d):");
  for (const s of topDur) {
    console.log(
      `  ${Math.round(s.durationMs / 60000)} min — ${s.artistName} - ${s.trackName} (${s.trackId})`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
