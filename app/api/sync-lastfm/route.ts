import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRecentTracks, isLastFmConfigured, lastFmScrobbleDurationMs } from "@/lib/lastfm";
import { isRequestAuthorized } from "@/lib/auth";
import { lastFmScrobbleStreamId, scrobbleIdentityKey } from "@/lib/stream-ids";

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

    const playedAts = readyTracks.map((t) => t.playedAt);
    const minPlayed = new Date(Math.min(...playedAts.map((d) => d.getTime())));
    const maxPlayed = new Date(Math.max(...playedAts.map((d) => d.getTime())));

    const existing = await db.stream.findMany({
      where: {
        isDemo: false,
        playedAt: { gte: minPlayed, lte: maxPlayed },
      },
      select: { artistName: true, trackName: true, playedAt: true },
    });
    const seen = new Set(
      existing.map((row) => scrobbleIdentityKey(row.artistName, row.trackName, row.playedAt))
    );

    const novel = readyTracks.filter(
      (t) => !seen.has(scrobbleIdentityKey(t.artist, t.name, t.playedAt))
    );

    if (novel.length === 0) {
      return NextResponse.json({
        synced: 0,
        fetched: tracks.length,
        message: "No new scrobbles",
      });
    }

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
