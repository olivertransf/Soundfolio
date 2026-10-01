import type { Stream } from "@/lib/types/stream";

type ListenRow = {
  playedAt: Date;
  durationMs: number;
  trackId: string;
};

/**
 * Spotify extended-history timestamps are the end of the play, and `durationMs` is how long it played.
 * Last.fm scrobble times line up with the start of that song. Spotify recently-played does too,
 * and those durations are whole seconds of at least two minutes.
 */
export function isListenEndAnchored(trackId: string, durationMs: number): boolean {
  if (trackId.startsWith("lfm-")) return false;
  if (durationMs >= 120_000 && durationMs % 1000 === 0) return false;
  return true;
}

const bucketDuration = new WeakMap<Stream, number>();

/** Catalog length or imported ms_played, before overlap credit. */
export function listenBucketDurationMs(row: Stream): number {
  return bucketDuration.get(row) ?? row.durationMs;
}

/**
 * Shorten each listen so it ends when the next one starts.
 * Stored history is unchanged. A song keeps its full duration when nothing overlaps it.
 */
export function creditListenDurations<T extends ListenRow>(rows: T[]): T[] {
  if (rows.length < 2) return rows;

  const windows = rows.map((row, index) => {
    const at = row.playedAt.getTime();
    const duration = Math.max(0, row.durationMs);
    if (isListenEndAnchored(row.trackId, row.durationMs)) {
      return { index, start: at - duration, end: at };
    }
    return { index, start: at, end: at + duration };
  });
  windows.sort((a, b) => a.start - b.start || a.end - b.end || a.index - b.index);

  const credited = new Array<number>(rows.length);
  for (let i = 0; i < windows.length; i++) {
    let end = windows[i].end;
    const next = windows[i + 1];
    if (next && end > next.start) end = next.start;
    credited[windows[i].index] = Math.max(0, end - windows[i].start);
  }

  let changed = false;
  for (let i = 0; i < rows.length; i++) {
    if (credited[i] !== rows[i].durationMs) {
      changed = true;
      break;
    }
  }
  if (!changed) return rows;

  return rows.map((row, index) => {
    if (credited[index] === row.durationMs) return row;
    const next = { ...row, durationMs: credited[index] };
    if ("id" in row) bucketDuration.set(next as Stream, row.durationMs);
    return next;
  });
}
