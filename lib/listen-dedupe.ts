import { normalizeEntityKey } from "@/lib/entity-normalize";

/** Cross-source plays of the same song inside this window count once. */
export const CROSS_SOURCE_WINDOW_MS = 90_000;

type ListenIdentity = {
  trackId: string;
  trackName: string;
  artistName: string;
  playedAt: Date;
  isDemo?: boolean;
};

/** Per-scrobble Last.fm ids (`lfm-…`), not catalog ids (`lfm-track-…`). */
export function isLastFmScrobbleId(trackId: string): boolean {
  const id = trackId.trim();
  return id.startsWith("lfm-") && !id.startsWith("lfm-track-");
}

export function songIdentityKey(artistName: string, trackName: string): string {
  return `${normalizeEntityKey(artistName)}\0${normalizeEntityKey(trackName)}`;
}

function listensCollide(left: ListenIdentity, right: ListenIdentity): boolean {
  if (left.playedAt.getTime() === right.playedAt.getTime()) return true;
  const leftLastFm = isLastFmScrobbleId(left.trackId);
  const rightLastFm = isLastFmScrobbleId(right.trackId);
  if (leftLastFm === rightLastFm) return false;
  return Math.abs(left.playedAt.getTime() - right.playedAt.getTime()) <= CROSS_SOURCE_WINDOW_MS;
}

/** Spotify / ZIP wins over Last.fm. Otherwise the earlier play wins. */
function preferListen<T extends ListenIdentity>(candidate: T, current: T): T {
  const candidateLastFm = isLastFmScrobbleId(candidate.trackId);
  const currentLastFm = isLastFmScrobbleId(current.trackId);
  if (candidateLastFm !== currentLastFm) return candidateLastFm ? current : candidate;
  return candidate.playedAt.getTime() < current.playedAt.getTime() ? candidate : current;
}

/**
 * Drop exact duplicate listens and Last.fm rows that repeat a Spotify/ZIP play.
 * Stored history is unchanged; callers use this before stats and recent lists.
 * Same-source replays with different timestamps still count.
 */
export function dedupeListens<T extends ListenIdentity>(rows: T[]): T[] {
  const groups = new Map<string, number[]>();
  rows.forEach((row, index) => {
    if (row.isDemo) return;
    const key = songIdentityKey(row.artistName, row.trackName);
    const list = groups.get(key);
    if (list) list.push(index);
    else groups.set(key, [index]);
  });

  const drop = new Set<number>();
  for (const indices of groups.values()) {
    const sorted = [...indices].sort((a, b) => {
      const delta = rows[a].playedAt.getTime() - rows[b].playedAt.getTime();
      if (delta !== 0) return delta;
      return Number(isLastFmScrobbleId(rows[a].trackId)) - Number(isLastFmScrobbleId(rows[b].trackId));
    });
    const kept: number[] = [];
    for (const index of sorted) {
      const row = rows[index];
      const matchAt = kept.findIndex((keptIndex) => listensCollide(rows[keptIndex], row));
      if (matchAt === -1) {
        kept.push(index);
        continue;
      }
      const keptIndex = kept[matchAt];
      if (preferListen(row, rows[keptIndex]) === row) {
        drop.add(keptIndex);
        kept[matchAt] = index;
      } else {
        drop.add(index);
      }
    }
  }

  if (drop.size === 0) return rows;
  return rows.filter((_, index) => !drop.has(index));
}
