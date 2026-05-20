import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveAlbumArt } from "@/lib/resolve-art";
import { isRequestAuthorized } from "@/lib/auth";

export const maxDuration = 60;

const MAX_PER_RUN = 45;
const DELAY_MS = 350;

export async function POST(req: NextRequest) {
  if (!isRequestAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const missing = await db.stream.groupBy({
      by: ["trackId", "trackName", "artistName", "albumName"],
      where: { albumArt: null },
    });

    if (missing.length === 0) {
      return NextResponse.json({
        updated: 0,
        total: 0,
        remaining: 0,
        message: "No tracks missing album artwork",
      });
    }

    const toProcess = missing.slice(0, MAX_PER_RUN);
    const remaining = missing.length - toProcess.length;
    let updated = 0;

    for (const m of toProcess) {
      const art = await resolveAlbumArt(m);
      if (art) {
        const result = await db.stream.updateMany({
          where: { trackId: m.trackId, albumArt: null },
          data: { albumArt: art },
        });
        updated += result.count;
      }
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    return NextResponse.json({
      updated,
      total: toProcess.length,
      remaining,
      source: "lastfm_itunes_coverartarchive",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backfill failed";
    console.error("Backfill error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
