import {
  LASTFM_MIN_CATALOG_MS,
  normalizeCatalogDurationMs,
  resolveLastFmCatalogDurationMs,
} from "@/lib/lastfm";

export type LastFmTimelineRow = {
  id: string;
  trackId: string;
  artistName: string;
  trackName: string;
  playedAt: Date;
  durationMs: number;
};

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
  if (gap <= 0) return LASTFM_MIN_CATALOG_MS;
  return Math.min(catalog, Math.max(gap, LASTFM_MIN_CATALOG_MS));
}

export function isLastFmStream(trackId: string): boolean {
  return trackId.startsWith("lfm-");
}

/** Recompute listen durations for Last.fm rows using gaps to the next play. */
export async function recomputeLastFmListenDurations(
  timeline: LastFmTimelineRow[]
): Promise<Map<string, number>> {
  if (timeline.length === 0) return new Map();

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

  const updates = new Map<string, number>();
  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i];
    if (!isLastFmStream(row.trackId)) continue;

    const nextPlayedAt = sorted[i + 1]?.playedAt ?? null;
    const listenMs = inferLastFmListenDurationMs(catalogByIndex[i], row.playedAt, nextPlayedAt);
    if (row.durationMs !== listenMs) updates.set(row.id, listenMs);
  }

  return updates;
}
