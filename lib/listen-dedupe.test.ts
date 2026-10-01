import assert from "node:assert/strict";
import test from "node:test";
import { dedupeListens } from "@/lib/listen-dedupe";
import { historyChartData } from "@/lib/stats-chart-data";
import { computeStreamsByMonth, computeStreamsByWeek, computeTotalStats } from "@/lib/stats-compute";
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

test("exact identity keeps one row", () => {
  const at = new Date("2026-01-02T12:00:00.000Z");
  const rows = dedupeListens([
    stream({ trackId: "lfm-a", playedAt: at, durationMs: 200_000 }),
    stream({ trackId: "lfm-b", playedAt: at, durationMs: 180_000 }),
  ]);
  assert.equal(rows.length, 1);
});

test("cross-source overlap keeps the Spotify row", () => {
  const spotifyAt = new Date("2026-01-02T12:00:30.000Z");
  const lastFmAt = new Date("2026-01-02T12:00:00.000Z");
  const rows = dedupeListens([
    stream({ trackId: "lfm-abc", trackName: "Song", artistName: "Artist", playedAt: lastFmAt, durationMs: 200_000 }),
    stream({ trackId: "spotify-1", trackName: "Song", artistName: "Artist", playedAt: spotifyAt, durationMs: 90_000 }),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.trackId, "spotify-1");
  assert.equal(computeTotalStats(rows).totalStreams, 1);
});

test("same-source replays more than 90 seconds apart both count", () => {
  const rows = dedupeListens([
    stream({ trackId: "lfm-1", playedAt: new Date("2026-01-02T12:00:00.000Z") }),
    stream({ trackId: "lfm-2", playedAt: new Date("2026-01-02T12:03:00.000Z") }),
  ]);
  assert.equal(rows.length, 2);
});

test("history series honor the range end", () => {
  const streams = [
    stream({ trackId: "s1", playedAt: new Date("2026-01-10T15:00:00.000Z"), durationMs: 60_000 }),
    stream({ trackId: "s2", playedAt: new Date("2026-03-10T15:00:00.000Z"), durationMs: 60_000 }),
  ];
  const filter = {
    since: new Date("2026-01-01T00:00:00.000Z"),
    until: new Date("2026-01-31T23:59:59.000Z"),
    label: "January",
  };
  const weeks = computeStreamsByWeek(streams, 52, filter, "UTC");
  const months = computeStreamsByMonth(streams, 12, filter, "UTC");
  assert.equal(weeks.reduce((sum, row) => sum + row.streams, 0), 1);
  assert.equal(months.reduce((sum, row) => sum + row.streams, 0), 1);
  assert.equal(computeTotalStats(streams, filter).totalStreams, 1);
});

test("history chart puts the latest bucket on the left", () => {
  const streams = [
    stream({ trackId: "s1", playedAt: new Date("2026-01-10T15:00:00.000Z"), durationMs: 60_000 }),
    stream({ trackId: "s2", playedAt: new Date("2026-03-10T15:00:00.000Z"), durationMs: 60_000 }),
  ];
  const filter = {
    since: new Date("2026-01-01T00:00:00.000Z"),
    until: new Date("2026-03-31T23:59:59.000Z"),
    label: "Q1",
  };
  const months = historyChartData(streams, "months", filter, "UTC");
  assert.equal(months[0]?.label, "2026-03");
  assert.equal(months.at(-1)?.label, "2026-01");
});
