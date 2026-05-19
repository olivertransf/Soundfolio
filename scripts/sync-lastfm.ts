import "dotenv/config";
import { db } from "../lib/db";
import { getRecentTracks, isLastFmConfigured, lastFmScrobbleDurationMs } from "../lib/lastfm";
import { lastFmScrobbleStreamId, scrobbleIdentityKey } from "../lib/stream-ids";

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

  const playedAts = readyTracks.map((t) => t.playedAt);
  const minPlayed = new Date(Math.min(...playedAts.map((d) => d.getTime())));
  const maxPlayed = new Date(Math.max(...playedAts.map((d) => d.getTime())));
  const existing = await db.stream.findMany({
    where: { isDemo: false, playedAt: { gte: minPlayed, lte: maxPlayed } },
    select: { artistName: true, trackName: true, playedAt: true },
  });
  const seen = new Set(
    existing.map((r) => scrobbleIdentityKey(r.artistName, r.trackName, r.playedAt))
  );
  const novel = readyTracks.filter(
    (t) => !seen.has(scrobbleIdentityKey(t.artist, t.name, t.playedAt))
  );

  const durationMs = lastFmScrobbleDurationMs();
  const result = await db.stream.createMany({
    data: novel.map((t) => ({
      trackId: lastFmScrobbleStreamId(t.artist, t.name, t.playedAt),
      trackName: t.name,
      artistName: t.artist,
      artistArt: null,
      albumName: t.album,
      albumArt: t.image,
      durationMs,
      playedAt: t.playedAt,
      isDemo: false,
    })),
    skipDuplicates: true,
  });

  console.log(`Synced ${result.count} new scrobbles (${novel.length} novel / ${readyTracks.length} ready).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
