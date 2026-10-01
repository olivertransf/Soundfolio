import assert from "node:assert/strict";
import test from "node:test";
import { computeAlbumDetail, computeTrackDetail, parseTimeRange } from "@/lib/stats-compute";
import type { Stream } from "@/lib/types/stream";

function stream(partial: Partial<Stream> & Pick<Stream, "playedAt" | "albumName">): Stream {
  const playedAt = partial.playedAt;
  return {
    id: partial.id ?? `${playedAt.getTime()}`,
    trackId: partial.trackId ?? "track",
    trackName: partial.trackName ?? "Song",
    artistName: partial.artistName ?? "Artist",
    artistArt: null,
    albumName: partial.albumName,
    albumArt: null,
    durationMs: partial.durationMs ?? 180_000,
    playedAt,
    isDemo: false,
    createdAt: playedAt,
    updatedAt: playedAt,
  };
}

test("album first play ignores the selected year", () => {
  const streams = [
    stream({
      albumName: "La La Land",
      playedAt: new Date("2024-11-30T20:00:00.000Z"),
    }),
    stream({
      albumName: "La La Land (Original Motion Picture Soundtrack)",
      playedAt: new Date("2026-05-13T20:00:00.000Z"),
    }),
  ];
  const detail = computeAlbumDetail(streams, "La La Land (Original Motion Picture Soundtrack)", "Artist", parseTimeRange("ytd"));
  assert.equal(detail.streams, 1);
  assert.equal(detail.firstPlayedAt?.toISOString().slice(0, 10), "2024-11-30");
});

test("album first play includes an earlier listen tagged as another album", () => {
  const streams = [
    stream({
      trackName: "Lover Girl",
      albumName: "Lover Girl",
      playedAt: new Date("2025-07-05T20:00:00.000Z"),
    }),
    stream({
      trackName: "Lover Girl",
      albumName: "A Matter of Time",
      playedAt: new Date("2026-08-23T20:00:00.000Z"),
    }),
  ];
  const detail = computeAlbumDetail(streams, "A Matter of Time", "Artist", parseTimeRange("ytd"));
  assert.equal(detail.streams, 1);
  assert.equal(detail.firstPlayedAt?.toISOString().slice(0, 10), "2025-07-05");
});

test("track first play ignores the selected year", () => {
  const streams = [
    stream({
      trackName: "Song",
      albumName: "Album",
      playedAt: new Date("2024-09-11T20:00:00.000Z"),
    }),
    stream({
      trackName: "Song",
      albumName: "Album",
      playedAt: new Date("2026-05-13T20:00:00.000Z"),
    }),
  ];
  const detail = computeTrackDetail(streams, "Song", "Artist", parseTimeRange("ytd"));
  assert.equal(detail.streams, 1);
  assert.equal(detail.firstPlayedAt?.toISOString().slice(0, 10), "2024-09-11");
  assert.equal(detail.lastPlayedAt?.toISOString().slice(0, 10), "2026-05-13");
});
