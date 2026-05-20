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

  const fromTimestamp = latest?.playedAt
    ? Math.max(0, Math.floor(latest.playedAt.getTime() / 1000) - 120)
    : undefined;

  const tracks = await getRecentTracks(username, 200, fromTimestamp);
  const readyTracks = tracks.filter((track) => track.playedAt.getTime() <= Date.now() + 5 * 60 * 1000);
  if (readyTracks.length === 0) {
    console.log("No scrobbles ready to import.");
    return;
  }

  const existing = await loadExistingInPlayWindow(readyTracks);
  const novel = filterNovelScrobbles(readyTracks, existing);
  const { inserted, durationUpdates, ignored } = await insertLastFmScrobbles(novel);

  console.log(
    `Synced ${inserted} new scrobbles (${novel.length} novel / ${readyTracks.length} ready, ${ignored} ignored <10s gap). Adjusted ${durationUpdates} listen durations.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
