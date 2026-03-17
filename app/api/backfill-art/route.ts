import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTracks } from "@/lib/spotify";
import { getAlbumArtFromItunes } from "@/lib/itunes";
import { getAlbumArtFromCoverArtArchive } from "@/lib/coverartarchive";
import { getTrackArt } from "@/lib/lastfm";

export const maxDuration = 60;

const SPOTIFY_ID_REGEX = /^[a-zA-Z0-9]{22}$/;
const MAX_PER_RUN = 500;
const BATCH_SIZE = 50;
const DELAY_MS = 150;
const FALLBACK_DELAY_MS = 400;

export async function POST() {
  try {
  const missing = await db.stream.groupBy({
    by: ["trackId", "trackName", "artistName", "albumName"],
    where: { albumArt: null },
  });

  const spotifyTracks = missing.filter(
    (m) => !m.trackId.startsWith("lfm-") && SPOTIFY_ID_REGEX.test(m.trackId)
  );
  if (spotifyTracks.length === 0) {
    return NextResponse.json({ updated: 0, total: 0, remaining: 0, message: "No Spotify tracks missing artwork (Last.fm tracks are skipped)" });
  }

  const toProcess = spotifyTracks.slice(0, MAX_PER_RUN);
  const remaining = spotifyTracks.length - toProcess.length;
  let updated = 0;
  let source = "spotify";

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
    source = "fallback";
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

  return NextResponse.json({ updated, total: toProcess.length, remaining, source });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backfill failed";
    console.error("Backfill error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
