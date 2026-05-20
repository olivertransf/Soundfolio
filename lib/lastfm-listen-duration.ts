import {
  normalizeCatalogDurationMs,
  resolveLastFmCatalogDurationMs,
} from "@/lib/lastfm";

/** Ignore Last.fm scrobbles when the next play starts sooner than this (skips / double scrobbles). */
export const LASTFM_MIN_SROBBLE_GAP_MS = 10_000;

export type LastFmTimelineRow = {
  id: string;
  trackId: string;
  artistName: string;
  trackName: string;
  playedAt: Date;
  durationMs: number;
};

/** Drop scrobbles whose next play (any source) is under {@link LASTFM_MIN_SROBBLE_GAP_MS}. */
export function shouldIgnoreLastFmScrobble(
  playedAt: Date,
  nextPlayedAt: Date | null | undefined
): boolean {
  if (!nextPlayedAt) return false;
  const gap = nextPlayedAt.getTime() - playedAt.getTime();
  return gap < LASTFM_MIN_SROBBLE_GAP_MS;
}

/**
 * Full catalog length unless the next scrobble (any source) happens sooner.
 * `playedAt` is Last.fm scrobble time, so this is an estimate, not wall-clock listen time.
 */
export function inferLastFmListenDurationMs(
  catalogMs: number,
  playedAt: Date,
  nextPlayedAt: Date | null | undefined
): number {
  const catalog = normalizeCatalogDurationMs(catalogMs);
  if (!nextPlayedAt) return catalog;

  const gap = nextPlayedAt.getTime() - playedAt.getTime();
  if (gap < LASTFM_MIN_SROBBLE_GAP_MS) return 0;
  return Math.min(catalog, gap);
}

export type LastFmDurationRecompute = {
  updates: Map<string, number>;
  deleteIds: string[];
};

export function isLastFmStream(trackId: string): boolean {
  return trackId.startsWith("lfm-");
}

/** Recompute listen durations for Last.fm rows using gaps to the next play. */
export async function recomputeLastFmListenDurations(
  timeline: LastFmTimelineRow[]
): Promise<LastFmDurationRecompute> {
  const updates = new Map<string, number>();
  const deleteIds: string[] = [];
  if (timeline.length === 0) return { updates, deleteIds };

  const sorted = [...timeline].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  const catalogCache = new Map<string, number>();

  const catalogByIndex: number[] = [];
  for (const row of sorted) {
    if (!isLastFmStream(row.trackId)) {
      catalogByIndex.push(row.durationMs);
      continue;
    }
    const key = `${row.artistName}\0${row.trackName}`;
    let catalog = catalogCache.get(key);
    if (catalog == null) {
      catalog = await resolveLastFmCatalogDurationMs(row.artistName, row.trackName, catalogCache);
    }
    catalogByIndex.push(catalog);
  }

  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i];
    if (!isLastFmStream(row.trackId)) continue;

    const nextPlayedAt = sorted[i + 1]?.playedAt ?? null;
    if (shouldIgnoreLastFmScrobble(row.playedAt, nextPlayedAt)) {
      deleteIds.push(row.id);
      continue;
    }

    const listenMs = inferLastFmListenDurationMs(catalogByIndex[i], row.playedAt, nextPlayedAt);
    if (row.durationMs !== listenMs) updates.set(row.id, listenMs);
  }

  return { updates, deleteIds };
}
