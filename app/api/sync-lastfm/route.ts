import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRecentTracks, isLastFmConfigured } from "@/lib/lastfm";
import { isRequestAuthorized } from "@/lib/auth";
import { lastFmTrackId } from "@/lib/stream-ids";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  if (!isRequestAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const username = process.env.LASTFM_USER?.trim();
  const apiKey = process.env.LASTFM_API_KEY?.trim();
  if (!isLastFmConfigured() || !username || !apiKey) {
    // 200 (not 400): SyncOnLoad POSTs on every page load; missing env is expected until configured.
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

    return NextResponse.json({
      synced: result.count,
      fetched: tracks.length,
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
