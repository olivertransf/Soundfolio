import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto as Crypto;

import "dotenv/config";
import { db } from "../lib/db";
import { getRecentTracks, isLastFmConfigured } from "../lib/lastfm";
import {
  filterNovelScrobbles,
  insertLastFmScrobbles,
  loadExistingInPlayWindow,
} from "../lib/lastfm-sync";

async function main() {
  const username = process.env.LASTFM_USER?.trim();
  if (!isLastFmConfigured() || !username) {
    console.error("Set LASTFM_USER and LASTFM_API_KEY in .env");
    process.exit(1);
  }

  const now = new Date();
  const latest = await db.stream.findFirst({
    where: { isDemo: false, playedAt: { lte: now } },
    orderBy: { playedAt: "desc" },
    select: { playedAt: true },
  });

  const SYNC_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;
  const fromTimestamp = latest?.playedAt
    ? Math.max(0, Math.floor((latest.playedAt.getTime() - SYNC_LOOKBACK_MS) / 1000))
    : undefined;

  const tracks = await getRecentTracks(username, 6000, fromTimestamp);
  const readyTracks = tracks.filter((track) => track.playedAt.getTime() <= Date.now() + 5 * 60 * 1000);
  if (readyTracks.length === 0) {
    console.log("No scrobbles ready to import.");
    return;
  }

  const existing = await loadExistingInPlayWindow(readyTracks);
  const novel = filterNovelScrobbles(readyTracks, existing);
  const batch = [...novel].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  let totalInserted = 0;
  let totalDurationUpdates = 0;
  const BATCH = 40;

  for (let offset = 0; offset < batch.length; offset += BATCH) {
    const slice = batch.slice(offset, offset + BATCH);
    const { inserted, durationUpdates } = await insertLastFmScrobbles(slice, undefined, {
      fast: true,
    });
    totalInserted += inserted;
    totalDurationUpdates += durationUpdates;
    if (inserted === 0) break;
  }

  console.log(
    `Synced ${totalInserted} new scrobbles (${novel.length} novel / ${readyTracks.length} ready). Adjusted ${totalDurationUpdates} listen durations.`
  );
  if (novel.length > totalInserted) {
    console.log("Run again to import remaining scrobbles.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
