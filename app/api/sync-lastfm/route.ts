import { NextRequest, NextResponse } from "next/server";
import { getRecentTracks, isLastFmConfigured } from "@/lib/lastfm";
import {
  filterNovelScrobbles,
  insertLastFmScrobbles,
  loadExistingInPlayWindow,
} from "@/lib/lastfm-sync";
import { isRequestAuthorized } from "@/lib/auth";
import { db } from "@/lib/db";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  if (!isRequestAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const username = process.env.LASTFM_USER?.trim();
  const apiKey = process.env.LASTFM_API_KEY?.trim();
  if (!isLastFmConfigured() || !username || !apiKey) {
    const detail =
      !apiKey && !username
        ? "Set LASTFM_USER and LASTFM_API_KEY in .env"
        : !apiKey
          ? "Set LASTFM_API_KEY in .env"
          : "Set LASTFM_USER in .env (your Last.fm profile name, e.g. the name in last.fm/user/yourname)";
    return NextResponse.json({
      synced: 0,
      skipped: true,
      message: "Last.fm not configured",
      detail,
    });
  }

  try {
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

    if (tracks.length === 0) {
      return NextResponse.json({ synced: 0, message: "No new scrobbles" });
    }

    const readyThroughMs = Date.now() + 5 * 60 * 1000;
    const readyTracks = tracks.filter((track) => track.playedAt.getTime() <= readyThroughMs);

    if (readyTracks.length === 0) {
      return NextResponse.json({ synced: 0, fetched: tracks.length, message: "No current scrobbles ready" });
    }

    const existing = await loadExistingInPlayWindow(readyTracks);
    const novel = filterNovelScrobbles(readyTracks, existing);

    if (novel.length === 0) {
      return NextResponse.json({
        synced: 0,
        fetched: tracks.length,
        message: "No new scrobbles",
      });
    }

    const { inserted, durationUpdates, ignored, artUpdated } = await insertLastFmScrobbles(novel);

    return NextResponse.json({
      synced: inserted,
      fetched: tracks.length,
      durationUpdates,
      ignored,
      artUpdated,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    console.error("Last.fm sync error:", err);
    return NextResponse.json({ error: "Sync failed", detail: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Use POST" }, { status: 405 });
}
