import { NextRequest, NextResponse } from "next/server";
import { backfillAlbumArtBatch, countMissingAlbumArtGroups } from "@/lib/backfill-art-queue";
import { isRequestAuthorized } from "@/lib/auth";

export const maxDuration = 60;

const MAX_PER_RUN = 45;
const DELAY_MS = 350;

export async function POST(req: NextRequest) {
  if (!(await isRequestAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const totalMissing = await countMissingAlbumArtGroups();
    if (totalMissing === 0) {
      return NextResponse.json({
        updated: 0,
        total: 0,
        remaining: 0,
        message: "No tracks missing album artwork",
      });
    }

    const { updated, processed, remaining } = await backfillAlbumArtBatch(
      MAX_PER_RUN,
      DELAY_MS
    );

    return NextResponse.json({
      updated,
      total: processed,
      remaining,
      source: "lastfm_itunes_song_coverartarchive",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backfill failed";
    console.error("Backfill error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
