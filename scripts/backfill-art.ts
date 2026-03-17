/**
 * Backfill album art for streams missing artwork.
 * Tries Spotify first; on 403, falls back to iTunes -> Cover Art Archive -> Last.fm.
 *
 * Usage: npx tsx scripts/backfill-art.ts
 */

import "dotenv/config";
import { db } from "../lib/db";
import { getTracks } from "../lib/spotify";
import { getAlbumArtFromItunes } from "../lib/itunes";
import { getAlbumArtFromCoverArtArchive } from "../lib/coverartarchive";
import { getTrackArt } from "../lib/lastfm";

const MAX_PER_RUN = 500;
const BATCH_SIZE = 50;
const DELAY_MS = 150;
const FALLBACK_DELAY_MS = 400;
const SPOTIFY_ID_REGEX = /^[a-zA-Z0-9]{22}$/;

async function main() {
  const missing = await db.stream.groupBy({
    by: ["trackId", "trackName", "artistName", "albumName"],
    where: { albumArt: null },
  });

  const spotifyTracks = missing.filter(
    (m) => !m.trackId.startsWith("lfm-") && SPOTIFY_ID_REGEX.test(m.trackId)
  );

  if (spotifyTracks.length === 0) {
    console.log("No Spotify tracks missing artwork (Last.fm tracks are skipped)");
    process.exit(0);
  }

  const toProcess = spotifyTracks.slice(0, MAX_PER_RUN);
  const remaining = spotifyTracks.length - toProcess.length;
  let updated = 0;

  console.log(`Processing ${toProcess.length} tracks (${remaining} remaining)...`);

  try {
    const ids = toProcess.map((t) => t.trackId);
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const tracks = await getTracks(batch);
      for (const t of tracks) {
        if (t.albumArt) {
          const result = await db.stream.updateMany({
            where: { trackId: t.id, albumArt: null },
            data: { albumArt: t.albumArt },
          });
          updated += result.count;
        }
      }
      if (i + BATCH_SIZE < ids.length) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    }
  } catch (err) {
    const is403 = err instanceof Error && err.message.includes("403");
    if (!is403) throw err;
    console.log("Spotify returned 403, using fallbacks (iTunes -> Cover Art Archive -> Last.fm)...");
    for (const m of toProcess) {
      let art: string | null = null;
      try {
        art = await getAlbumArtFromItunes(m.artistName, m.albumName);
      } catch {}
      if (!art && process.env.LASTFM_API_KEY) {
        try {
          art = await getTrackArt(m.artistName, m.trackName);
        } catch {}
      }
      if (!art) {
        try {
          art = await getAlbumArtFromCoverArtArchive(m.artistName, m.albumName);
        } catch {}
      }
      if (art) {
        const result = await db.stream.updateMany({
          where: { trackId: m.trackId, albumArt: null },
          data: { albumArt: art },
        });
        updated += result.count;
      }
      await new Promise((r) => setTimeout(r, FALLBACK_DELAY_MS));
    }
  }

  console.log(`Updated ${updated} streams. ${remaining} remaining.`);
}

main().catch((err) => {
  console.error("Backfill error:", err);
  process.exit(1);
});
