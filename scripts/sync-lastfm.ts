import "dotenv/config";
import { db } from "../lib/db";
import { getRecentTracks, isLastFmConfigured } from "../lib/lastfm";
import { lastFmTrackId } from "../lib/stream-ids";

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

  const result = await db.stream.createMany({
    data: readyTracks.map((t) => ({
      trackId: lastFmTrackId(t.artist, t.name, t.album),
      trackName: t.name,
      artistName: t.artist,
      artistArt: null,
      albumName: t.album,
      albumArt: t.image,
      durationMs: 180000,
      playedAt: t.playedAt,
      isDemo: false,
    })),
    skipDuplicates: true,
  });

  console.log(`Synced ${result.count} new scrobbles (${readyTracks.length} fetched).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
