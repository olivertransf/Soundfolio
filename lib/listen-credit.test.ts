import assert from "node:assert/strict";
import test from "node:test";
import { creditListenDurations } from "@/lib/listen-credit";
import { computeTotalStats } from "@/lib/stats-compute";
import type { Stream } from "@/lib/types/stream";

function stream(partial: Partial<Stream> & Pick<Stream, "trackId" | "playedAt">): Stream {
  const playedAt = partial.playedAt;
  return {
    id: partial.id ?? `${partial.trackId}-${playedAt.getTime()}`,
    trackId: partial.trackId,
    trackName: partial.trackName ?? "Song",
    artistName: partial.artistName ?? "Artist",
    artistArt: null,
    albumName: partial.albumName ?? "Album",
    albumArt: null,
    durationMs: partial.durationMs ?? 180_000,
    playedAt,
    isDemo: partial.isDemo ?? false,
    createdAt: playedAt,
    updatedAt: playedAt,
  };
}

test("a scrobble that starts before the previous song ends shortens that song", () => {
  const first = new Date("2026-04-01T12:00:00.000Z");
  const second = new Date(first.getTime() + 70_000);
  const streams = [
    stream({ trackId: "lfm-a", trackName: "First", playedAt: first, durationMs: 180_000 }),
    stream({ trackId: "lfm-b", trackName: "Second", playedAt: second, durationMs: 180_000 }),
  ];
  const [creditedFirst, creditedSecond] = creditListenDurations(streams);
  assert.equal(creditedFirst?.durationMs, 70_000);
  assert.equal(creditedSecond?.durationMs, 180_000);
  assert.equal(computeTotalStats(streams).totalStreams, 2);
  assert.equal(computeTotalStats(streams).totalMinutes, 4);
});

test("back-to-back songs that do not overlap keep their full length", () => {
  const first = new Date("2026-04-01T12:00:00.000Z");
  const second = new Date(first.getTime() + 180_000);
  const streams = [
    stream({ trackId: "lfm-a", playedAt: first, durationMs: 180_000 }),
    stream({ trackId: "lfm-b", playedAt: second, durationMs: 180_000 }),
  ];
  assert.equal(computeTotalStats(streams).totalMinutes, 6);
});

test("a later longer song does not shorten a finished scrobble", () => {
  const first = new Date("2026-04-01T12:00:00.000Z");
  const second = new Date(first.getTime() + 265_000);
  const streams = [
    stream({ trackId: "lfm-a", playedAt: first, durationMs: 180_000 }),
    stream({ trackId: "lfm-b", playedAt: second, durationMs: 313_000 }),
  ];
  const [firstCredit, secondCredit] = creditListenDurations(streams);
  assert.equal(firstCredit?.durationMs, 180_000);
  assert.equal(secondCredit?.durationMs, 313_000);
});

test("spotify history keeps time already listened when the next song starts after it", () => {
  const end = new Date("2026-04-01T12:00:00.000Z");
  const streams = [
    stream({ trackId: "hist-a", playedAt: end, durationMs: 90_000 }),
    stream({ trackId: "hist-b", playedAt: new Date(end.getTime() + 30_000), durationMs: 40_000 }),
  ];
  const [firstCredit, secondCredit] = creditListenDurations(streams);
  assert.equal(firstCredit?.durationMs, 80_000);
  assert.equal(secondCredit?.durationMs, 40_000);
});

test("a play just outside the range still cuts the listen inside it", () => {
  const first = new Date("2026-04-01T12:00:00.000Z");
  const second = new Date(first.getTime() + 70_000);
  const streams = [
    stream({ trackId: "spotifyTrack", playedAt: first, durationMs: 180_000 }),
    stream({ trackId: "spotifyNext", playedAt: second, durationMs: 180_000 }),
  ];
  const stats = computeTotalStats(streams, {
    since: first,
    until: new Date(first.getTime() + 60_000),
    label: "partial",
  });
  assert.equal(stats.totalStreams, 1);
  assert.equal(stats.totalMinutes, 1);
});
