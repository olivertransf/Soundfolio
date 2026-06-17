import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedStatsRequest } from "@/lib/stats-api-context";
import { getRecentStreams } from "@/lib/stats";
import { getNowPlayingTrack } from "@/lib/lastfm";
import { resolveAlbumArt, resolveArtistArt } from "@/lib/resolve-art";
import { lastFmTrackId } from "@/lib/stream-ids";
import { getUserProfile } from "@/lib/users";
import { getStatsApiUser } from "@/lib/stats-api-auth";
import {
  VIEWER_TIMEZONE_COOKIE,
  VIEWER_TIMEZONE_PARAM,
  correctLastFmPlayedAt,
  resolveStatsTimeZone,
} from "@/lib/stats-timezone";

export async function GET(req: NextRequest) {
  const { denied, userId } = await requireAuthenticatedStatsRequest(req);
  if (denied) return denied;

  const limit = Math.min(
    Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 100), 1),
    200
  );
  const timeZone = resolveStatsTimeZone(
    req.nextUrl.searchParams.get(VIEWER_TIMEZONE_PARAM) ??
      req.cookies.get(VIEWER_TIMEZONE_COOKIE)?.value
  );
  const streams = await getRecentStreams(limit, "me", userId);

  const apiUser = await getStatsApiUser(req);
  const profile = apiUser && !apiUser.isLegacy ? await getUserProfile(apiUser.uid) : null;
  const username =
    profile?.lastfmUsername?.trim() ||
    (apiUser?.isLegacy ? process.env.LASTFM_USER?.trim() : undefined);
  const nowPlaying = username ? await getNowPlayingTrack(username) : null;
  const nowPlayingStream = nowPlaying
    ? {
        id: "now-playing",
        trackId: lastFmTrackId(nowPlaying.artist, nowPlaying.name, nowPlaying.album),
        trackName: nowPlaying.name,
        artistName: nowPlaying.artist,
        albumName: nowPlaying.album,
        albumArt: await resolveAlbumArt({
          artistName: nowPlaying.artist,
          trackName: nowPlaying.name,
          albumName: nowPlaying.album,
          scrobbleImage: nowPlaying.image,
        }),
        artistArt: await resolveArtistArt(nowPlaying.artist),
        durationMs: 0,
        isDemo: false,
        createdAt: nowPlaying.playedAt.toISOString(),
        updatedAt: nowPlaying.playedAt.toISOString(),
        playedAt: nowPlaying.playedAt.toISOString(),
        isNowPlaying: true,
      }
    : null;
  const serializedStreams = streams.map((stream) => {
    const playedAt =
      stream.trackId.startsWith("lfm-")
        ? correctLastFmPlayedAt(stream.playedAt, timeZone)
        : stream.playedAt;
    return {
      ...stream,
      playedAt: playedAt.toISOString(),
    };
  });
  return NextResponse.json({
    streams: nowPlayingStream
      ? [nowPlayingStream, ...serializedStreams.filter((stream) => stream.trackId !== nowPlayingStream.trackId)].slice(0, limit)
      : serializedStreams,
    checkedAt: new Date().toISOString(),
  });
}
