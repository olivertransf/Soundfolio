import { NextRequest, NextResponse } from "next/server";
import { getRecentStreams } from "@/lib/stats";
import { getNowPlayingTrack } from "@/lib/lastfm";
import { lastFmTrackId } from "@/lib/stream-ids";

export async function GET(req: NextRequest) {
  const limit = Math.min(
    Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 100), 1),
    200
  );
  const streams = await getRecentStreams(limit);
  const username = process.env.LASTFM_USER?.trim();
  const nowPlaying = username ? await getNowPlayingTrack(username) : null;
  const nowPlayingStream = nowPlaying
    ? {
        id: "now-playing",
        trackId: lastFmTrackId(nowPlaying.artist, nowPlaying.name, nowPlaying.album),
        trackName: nowPlaying.name,
        artistName: nowPlaying.artist,
        albumName: nowPlaying.album,
        albumArt: nowPlaying.image,
        artistArt: null,
        durationMs: 0,
        isDemo: false,
        createdAt: nowPlaying.playedAt.toISOString(),
        updatedAt: nowPlaying.playedAt.toISOString(),
        playedAt: nowPlaying.playedAt.toISOString(),
        isNowPlaying: true,
      }
    : null;
  const serializedStreams = streams.map((stream) => ({
    ...stream,
    playedAt: stream.playedAt.toISOString(),
  }));
  return NextResponse.json({
    streams: nowPlayingStream
      ? [nowPlayingStream, ...serializedStreams.filter((stream) => stream.trackId !== nowPlayingStream.trackId)].slice(0, limit)
      : serializedStreams,
    checkedAt: new Date().toISOString(),
  });
}
