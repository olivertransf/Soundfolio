/**
 * Sanity-check stored listen durations against gap-to-next-play rule.
 *
 * Usage: MONGODB_URI=... npx tsx scripts/validate-listen-durations.ts
 */
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto as Crypto;

import "dotenv/config";
import { mongoDb } from "../lib/db";
import { inferLastFmListenDurationMs, isLastFmStream } from "../lib/lastfm-listen-duration";
import {
  LASTFM_MAX_CATALOG_MS,
  LASTFM_MIN_CATALOG_MS,
  normalizeCatalogDurationMs,
} from "../lib/lastfm";

async function main() {
  const col = (await mongoDb()).collection("streams");
  const rows = await col
    .find({ isDemo: false })
    .project({ trackId: 1, playedAt: 1, durationMs: 1 })
    .sort({ playedAt: 1 })
    .toArray();

  let lfm = 0;
  let ruleMismatch = 0;
  let underMin = 0;
  let overCap = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!isLastFmStream(row.trackId)) continue;
    lfm++;

    if (row.durationMs < LASTFM_MIN_CATALOG_MS - 1) underMin++;
    if (row.durationMs > LASTFM_MAX_CATALOG_MS) overCap++;

    const next = rows[i + 1];
    const catalog = normalizeCatalogDurationMs(row.durationMs);
    const expected = inferLastFmListenDurationMs(
      catalog,
      row.playedAt,
      next?.playedAt ?? null
    );
    if (Math.abs(row.durationMs - expected) > 1500) ruleMismatch++;
  }

  const since7d = new Date(Date.now() - 7 * 86400000);
  const week = await col
    .aggregate([
      { $match: { isDemo: false, playedAt: { $gte: since7d } } },
      {
        $group: {
          _id: null,
          plays: { $sum: 1 },
          minutes: { $sum: { $divide: ["$durationMs", 60000] } },
          maxDurMin: { $max: { $divide: ["$durationMs", 60000] } },
        },
      },
    ])
    .toArray();

  console.log("Last.fm rows:", lfm);
  console.log("Rule mismatches (±1.5s):", ruleMismatch, "| under 30s min:", underMin, "| over 90m cap:", overCap);
  console.log("Last 7d totals:", week[0] ?? "none");
  if (ruleMismatch === 0 && overCap === 0) console.log("OK — Last.fm durations match gap + catalog rule.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
