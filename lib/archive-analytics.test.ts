import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildArchive,
  monthlyInsights,
  comparePeriods,
  shiftMonth,
  listeningSessions,
  trackLife,
  monthNarrative,
  artistShareOverlap,
  suggestedBoundaries,
  repeatedSequences,
} from "./archive-analytics";
import { annotationStorageKey, emptyArchiveNotes } from "./archive-notes";
import type { Stream } from "./types/stream";
function row(
  at: string,
  name = "A",
  id = "spotify:a",
  duration = 180001,
): Stream {
  return {
    id: at + name,
    trackId: id,
    trackName: name,
    artistName: "Artist " + name,
    albumName: "Album",
    albumArt: null,
    artistArt: null,
    playedAt: new Date(at),
    durationMs: duration,
    isDemo: false,
    createdAt: new Date(at),
    updatedAt: new Date(at),
  };
}
test("calendar boundaries use listener timezone, including year rollover", () => {
  const a = buildArchive([row("2024-01-01T07:30:00Z")], "America/Los_Angeles");
  assert.equal(a.months.get("2023-12")?.rows.length, 1);
  assert.equal(shiftMonth("2024-01", -1), "2023-12");
});
test("first observed and boundary flags do not depend on input order", () => {
  const a = buildArchive([row("2024-02-15Z"), row("2024-01-15Z")]);
  assert.equal(a.all.tracks[0].first, "2024-01-15");
  assert.equal(monthlyInsights(a, "2024-01").boundary, true);
  assert.equal(monthlyInsights(a, "2024-02").first.length, 0);
});
test("retention uses bounded future window and flags insufficient followup", () => {
  const rows = [
    row("2024-02-01Z"),
    row("2024-03-01Z"),
    row("2024-03-02Z"),
    row("2024-04-01Z"),
    row("2024-06-01Z", "B"),
  ];
  const a = buildArchive(rows);
  assert.equal(monthlyInsights(a, "2024-02").retained.length, 1);
  assert.equal(monthlyInsights(a, "2024-04").followup, false);
});
test("deduplication preserves same-source replays and excludes cross-source overlap", () => {
  const a = buildArchive([
    row("2024-02-01T00:00:00Z"),
    row("2024-02-01T00:00:00Z"),
    row("2024-02-01T00:01:00Z", "A", "lfm-123"),
    row("2024-02-01T00:03:00Z"),
  ]);
  assert.equal(a.rows.length, 2);
  assert.equal(a.duplicates, 2);
});
test("source duration uncertainty and missing values remain explicit", () => {
  const a = buildArchive([
    row("2024-02-01Z", "A", "lfm-1"),
    row("2024-02-02Z", "B", "other", 0),
  ]);
  assert.equal(a.all.estimatedTime, 1);
  assert.equal(a.all.unknownTime, 1);
  assert.equal(a.all.ms, 180001);
});
test("zero denominators and unequal durations", () => {
  const a = buildArchive([row("2024-02-01Z"), row("2024-03-01Z")]);
  const c = comparePeriods(
    a.range("2024-02-01", "2024-02-29"),
    a.range("2024-03-01", "2024-03-31"),
  );
  assert.equal(c.perDayA, 1 / 29);
  assert.equal(c.perDayB, 1 / 31);
  assert.equal(
    comparePeriods(a.empty("2024-01"), a.empty("2024-02")).overlap,
    0,
  );
});
test("missing months do not create invented plays; sessions respect threshold", () => {
  const a = buildArchive([
    row("2024-01-01T00:00Z"),
    row("2024-01-01T00:29Z"),
    row("2024-01-01T01:01Z"),
  ]);
  assert.equal(a.months.has("2024-02"), false);
  assert.equal(listeningSessions(a).length, 2);
});
test("annotation namespaces isolate accounts and demo; analytics cannot mutate annotations", () => {
  assert.notEqual(
    annotationStorageKey(true, "a"),
    annotationStorageKey(false, "a"),
  );
  assert.notEqual(
    annotationStorageKey(false, "a"),
    annotationStorageKey(false, "b"),
  );
  const notes = emptyArchiveNotes();
  notes.memories.push({
    id: "1",
    target: "month:2024-01",
    title: "Keep",
    text: "My words",
    tags: "",
    link: "",
  });
  buildArchive([row("2024-01-01Z")]);
  buildArchive([]);
  assert.equal(notes.memories[0].text, "My words");
});

test("artist losses to zero are included without percent-from-zero claims", () => {
  const rows = Array.from({ length: 5 }, (_, i) =>
    row(`2024-01-0${i + 1}Z`, "A"),
  ).concat(Array.from({ length: 5 }, (_, i) => row(`2024-02-0${i + 1}Z`, "B")));
  const change = monthlyInsights(buildArchive(rows), "2024-02").changes.find(
    (t) => t.name === "Artist A",
  );
  assert.equal(change?.plays, 0);
  assert.equal(change?.delta, -1);
});
test("archive index reuses immutable provider snapshots and invalidates on a new snapshot", () => {
  const rows = [row("2024-01-01Z")];
  assert.equal(buildArchive(rows), buildArchive(rows));
  assert.notEqual(buildArchive(rows), buildArchive([...rows]));
  assert.notEqual(
    buildArchive(rows),
    buildArchive(rows, "America/Los_Angeles"),
  );
});
test("missing albums do not invent an album and invalid duration does not poison totals", () => {
  const r = row("2024-01-01Z");
  r.albumName = "";
  r.durationMs = Infinity;
  const a = buildArchive([r]);
  assert.equal(a.all.albums.length, 0);
  assert.equal(a.all.ms, 0);
  assert.equal(a.all.unknownTime, 1);
});

test("life stories expose repeat bursts, consecutive days and recorded returns", () => {
  const rows = Array.from({ length: 5 }, (_, i) =>
    row(`2024-01-01T0${i}:00:00Z`),
  );
  rows.push(row("2024-01-02Z"), row("2024-06-01Z"));
  const a = buildArchive(rows);
  const life = trackLife(a, a.all.tracks[0].key)!;
  assert.equal(life.longestStreak, 2);
  assert.equal(life.bursts[0][1], 5);
  assert.equal(life.gaps.length, 1);
  assert.match(monthNarrative(a.months.get("2024-01")!), /led with/);
});
test("era suggestions use distributions and require sustained activity", () => {
  const rows = [];
  for (let d = 1; d <= 20; d++)
    for (const [m, name] of [
      ["01", "A"],
      ["02", "B"],
      ["03", "B"],
    ])
      rows.push(row(`2024-${m}-${String(d).padStart(2, "0")}Z`, name));
  const a = buildArchive(rows);
  assert.equal(
    artistShareOverlap(a.months.get("2024-01")!, a.months.get("2024-02")!),
    0,
  );
  assert.deepEqual(suggestedBoundaries(a), [{ month: "2024-02", overlap: 0 }]);
  assert.equal(suggestedBoundaries(buildArchive(rows.slice(0, 3))).length, 0);
});
test("repeated sequences require three observed adjacent pairs", () => {
  const s = [row("2024-01-01T00:00Z", "A"), row("2024-01-01T00:03Z", "B")];
  assert.equal(repeatedSequences([s, s]).length, 0);
  assert.equal(repeatedSequences([s, s, s])[0].count, 3);
});

test("real archive excludes demo-flagged records rather than mixing sources", () => {
  const fictional = row("2024-01-01Z");
  fictional.isDemo = true;
  assert.equal(buildArchive([fictional]).rows.length, 0);
});
