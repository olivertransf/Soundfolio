import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "@/lib/auth/verify-id-token";
import { DEV_LASTFM_USERNAME } from "@/lib/dev-lastfm-user";
import { getDevLibrary, writeDevStreams } from "@/lib/dev-firestore";
import { getRecentTracks, isLastFmConfigured } from "@/lib/lastfm";
import {
  filterNovelScrobbles,
  prepareLastFmScrobbleStreams,
} from "@/lib/lastfm-sync";
import { normalizeEntityKey } from "@/lib/entity-normalize";
import { resolveArtistArt } from "@/lib/resolve-art";
import { isUsableArtUrl } from "@/lib/stats-compute";
import {
  VIEWER_TIMEZONE_COOKIE,
  VIEWER_TIMEZONE_PARAM,
  resolveStatsTimeZone,
} from "@/lib/stats-timezone";

export const maxDuration = 60;

const SYNC_BATCH_SIZE = 200;
/** Overlap so a play that landed during the previous sync is not missed. */
const SYNC_LOOKBACK_MS = 2 * 60 * 60 * 1000;
const MAX_ARTIST_ART_RESOLVES = 8;

type SyncRequestBody = {
  lastfmUsername?: string;
  latestPlayedAt?: string | null;
  existing?: Array<{
    artistName: string;
    trackName: string;
    playedAt: string;
    trackId?: string;
    artistArt?: string | null;
  }>;
  knownDurations?: Record<string, number>;
};

function bearerToken(request: NextRequest) {
  const bearer = request.headers.get("authorization");
  if (!bearer?.startsWith("Bearer ")) return null;
  return bearer.slice("Bearer ".length).trim();
}

export async function POST(req: NextRequest) {
  const token = bearerToken(req);
  const devSync = process.env.NODE_ENV === "development" && !token;

  let uid: string;
  if (devSync) {
    uid = (await getDevLibrary()).user.uid;
  } else {
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      ({ uid } = await verifyFirebaseIdToken(token));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid token";
      return NextResponse.json({ error: message }, { status: 401 });
    }
  }

  const apiKey = process.env.LASTFM_API_KEY?.trim();
  if (!isLastFmConfigured() || !apiKey) {
    return NextResponse.json({
      synced: 0,
      skipped: true,
      message: "Last.fm not configured",
      detail: "Set LASTFM_API_KEY in server environment variables.",
    });
  }

  const body = (await req.json().catch(() => ({}))) as SyncRequestBody;
  const username = devSync ? DEV_LASTFM_USERNAME : body.lastfmUsername?.trim();
  if (!username) {
    return NextResponse.json({
      synced: 0,
      skipped: true,
      message: "Last.fm username not configured",
      detail: "Add your Last.fm username in onboarding.",
    });
  }

  try {
    const latestPlayedAt = body.latestPlayedAt ? new Date(body.latestPlayedAt) : null;
    const fromTimestamp =
      latestPlayedAt && !isNaN(latestPlayedAt.getTime())
        ? Math.max(0, Math.floor((latestPlayedAt.getTime() - SYNC_LOOKBACK_MS) / 1000))
        : undefined;

    const tracks = await getRecentTracks(username, 6000, fromTimestamp);
    if (tracks.length === 0) {
      return NextResponse.json({ synced: 0, streams: [], message: "No new scrobbles" });
    }

    const readyThroughMs = Date.now() + 5 * 60 * 1000;
    const readyTracks = tracks.filter((track) => track.playedAt.getTime() <= readyThroughMs);
    if (readyTracks.length === 0) {
      return NextResponse.json({
        synced: 0,
        streams: [],
        fetched: tracks.length,
        message: "No current scrobbles ready",
      });
    }

    const existing = (body.existing ?? []).map((row) => ({
      artistName: row.artistName,
      trackName: row.trackName,
      playedAt: new Date(row.playedAt),
      trackId: row.trackId,
    }));
    const novel = filterNovelScrobbles(readyTracks, existing);
    if (novel.length === 0) {
      return NextResponse.json({
        synced: 0,
        streams: [],
        fetched: tracks.length,
        message: "No new scrobbles",
      });
    }

    const timeZone = resolveStatsTimeZone(
      req.nextUrl.searchParams.get(VIEWER_TIMEZONE_PARAM) ??
        req.cookies.get(VIEWER_TIMEZONE_COOKIE)?.value
    );
    const batch = [...novel]
      .sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime())
      .slice(0, SYNC_BATCH_SIZE);

    const artistArtByKey = new Map<string, string>();
    for (const row of body.existing ?? []) {
      if (!isUsableArtUrl(row.artistArt)) continue;
      const key = normalizeEntityKey(row.artistName);
      if (!artistArtByKey.has(key)) artistArtByKey.set(key, row.artistArt);
    }

    const missingArtists: string[] = [];
    const seenMissing = new Set<string>();
    for (const item of batch) {
      const key = normalizeEntityKey(item.artist);
      if (artistArtByKey.has(key) || seenMissing.has(key)) continue;
      seenMissing.add(key);
      missingArtists.push(item.artist);
    }

    for (const artistName of missingArtists.slice(0, MAX_ARTIST_ART_RESOLVES)) {
      try {
        const art = await resolveArtistArt(artistName);
        if (isUsableArtUrl(art)) {
          artistArtByKey.set(normalizeEntityKey(artistName), art);
        }
      } catch {
        // keep null; backfill can fill later
      }
    }

    const durationCache = new Map<string, number>();
    for (const [key, value] of Object.entries(body.knownDurations ?? {})) {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        durationCache.set(key, value);
      }
    }

    const streams = await prepareLastFmScrobbleStreams(batch, timeZone, {
      artistArtByKey,
      durationCache,
    });
    if (devSync) {
      await writeDevStreams(uid, streams);
    }
    const hasMore = novel.length > batch.length;
    const durations: Record<string, number> = {};
    for (const [key, value] of durationCache) durations[key] = value;

    return NextResponse.json({
      uid,
      synced: streams.length,
      fetched: tracks.length,
      pending: novel.length - batch.length,
      totalNovel: novel.length,
      hasMore,
      durations,
      streams,
      persisted: devSync,
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
