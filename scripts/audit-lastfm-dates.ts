/**
 * Compare DB Last.fm playedAt to Last.fm API uts for a sample window.
 *
 * Usage: npx tsx scripts/audit-lastfm-dates.ts [fromIso] [limit]
 */
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto as Crypto;

import "dotenv/config";
import { MongoClient } from "mongodb";
import { getRecentTracks, isLastFmConfigured } from "../lib/lastfm";
import {
  correctLastFmPlayedAt,
  getHourInTimeZone,
  lastFmLooksWallTimeAsUtc,
  resolveStatsTimeZone,
} from "../lib/stats-timezone";

const timeZone = resolveStatsTimeZone(process.argv.find((a) => a.includes("/")));
const fromIso = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}/.test(a)) ?? "2026-05-24";
const limit = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? "30");

async function main() {
  const username = process.env.LASTFM_USER?.trim();
  if (!isLastFmConfigured() || !username) {
    console.error("LASTFM_USER and LASTFM_API_KEY required");
    process.exit(1);
  }

  const from = Math.floor(new Date(fromIso).getTime() / 1000);
  const apiTracks = await getRecentTracks(username, 200, from);
  const apiByKey = new Map(
    apiTracks.map((t) => [
      `${t.artist.toLocaleLowerCase()}\0${t.name.toLocaleLowerCase()}\0${t.playedAt.getTime()}`,
      t.playedAt,
    ])
  );

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI required");
  const client = await MongoClient.connect(uri);
  const col = client.db(process.env.MONGODB_DB || "soundfolio").collection("streams");
  const dbRows = await col
    .find({
      isDemo: false,
      trackId: { $regex: "^lfm-" },
      playedAt: { $gte: new Date(fromIso) },
    })
    .project({ artistName: 1, trackName: 1, playedAt: 1, trackId: 1 })
    .sort({ playedAt: -1 })
    .limit(limit)
    .toArray();

  let mismatch = 0;
  let flagged = 0;
  let wouldChangeOnRead = 0;

  for (const row of dbRows) {
    const playedAt = new Date(row.playedAt);
    const key = `${String(row.artistName).toLocaleLowerCase()}\0${String(row.trackName).toLocaleLowerCase()}\0${playedAt.getTime()}`;
    const apiAt = apiByKey.get(key);
    if (!apiAt) continue;

    const corrected = correctLastFmPlayedAt(playedAt, timeZone);
    if (lastFmLooksWallTimeAsUtc(playedAt, timeZone)) flagged++;
    if (corrected.getTime() !== playedAt.getTime()) wouldChangeOnRead++;

    if (apiAt.getTime() !== playedAt.getTime()) {
      mismatch++;
      console.log(
        "MISMATCH",
        row.artistName,
        row.trackName,
        "db",
        playedAt.toISOString(),
        "api",
        apiAt.toISOString()
      );
    }
  }

  const allFlagged = await col
    .find({ isDemo: false, trackId: { $regex: "^lfm-" } })
    .project({ artistName: 1, trackName: 1, playedAt: 1 })
    .toArray();
  const flaggedRows = allFlagged.filter((row) =>
    lastFmLooksWallTimeAsUtc(new Date(row.playedAt), timeZone)
  );

  console.log({
    timeZone,
    sampled: dbRows.length,
    apiTracks: apiTracks.length,
    mismatch,
    flagged,
    wouldChangeOnRead,
    totalFlaggedInDb: flaggedRows.length,
  });

  for (const row of flaggedRows.slice(0, 12)) {
    const playedAt = new Date(row.playedAt);
    const key = `${String(row.artistName).toLocaleLowerCase()}\0${String(row.trackName).toLocaleLowerCase()}\0${playedAt.getTime()}`;
    const corrected = correctLastFmPlayedAt(playedAt, timeZone);
    console.log("FLAGGED", {
      artist: row.artistName,
      db: playedAt.toISOString(),
      api: apiByKey.has(key) ? apiByKey.get(key)!.toISOString() : "not-in-api-window",
      wouldFixTo: corrected.toISOString(),
      hourLA: getHourInTimeZone(playedAt, timeZone),
    });
  }

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
