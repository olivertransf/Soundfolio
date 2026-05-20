/**
 * Compare hour-of-day buckets in UTC vs a viewer timezone.
 *
 * Usage: MONGODB_URI=... npx tsx scripts/diagnose-hours-tz.ts [America/Los_Angeles]
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

const tz = process.argv[2] ?? "America/Los_Angeles";

async function main() {
  const since = startOfYearInZone(new Date(), tz);
  const col = (await mongoDb()).collection("streams");
  const rows = await col
    .find({ isDemo: false, playedAt: { $gte: since }, durationMs: { $gt: 0 } })
    .project({ playedAt: 1, trackId: 1 })
    .toArray();

  const utc = Array.from({ length: 24 }, () => 0);
  const local = Array.from({ length: 24 }, () => 0);
  const fixed = Array.from({ length: 24 }, () => 0);
  let lfm = 0;
  let spotify = 0;

  for (const r of rows) {
    const d = new Date(r.playedAt);
    const durationMs = Number(r.durationMs ?? 0);
    const trackId = String(r.trackId);
    utc[d.getUTCHours()]++;
    local[getHourInTimeZone(d, tz)]++;
    fixed[getHourInTimeZone(getListenBucketInstant(d, durationMs, trackId, tz), tz)]++;
    if (trackId.startsWith("lfm-")) lfm++;
    else spotify++;
  }

  const top = (arr: number[]) =>
    arr
      .map((c, h) => [h, c] as const)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

  const sum = (arr: number[], from: number, to: number) =>
    arr.slice(from, to + 1).reduce((a, b) => a + b, 0);

  console.log("timezone:", tz);
  console.log("since:", since.toISOString());
  console.log("rows:", rows.length, `(lfm ${lfm}, other ${spotify})`);
  console.log("top UTC hours:", top(utc));
  console.log("top local hours (playedAt):", top(local));
  console.log("top bucket hours (fixed):", top(fixed));
  console.log("UTC 0-6:", sum(utc, 0, 6), "| UTC 14-23:", sum(utc, 14, 23));
  console.log("playedAt LA 0-6:", sum(local, 0, 6), "| LA 14-23:", sum(local, 14, 23));
  console.log("playedAt LA 7-13:", sum(local, 7, 13));
  console.log("bucket LA 0-6:", sum(fixed, 0, 6), "| LA 7-13:", sum(fixed, 7, 13), "| LA 14-23:", sum(fixed, 14, 23));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
