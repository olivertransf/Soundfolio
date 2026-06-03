import {
  LASTFM_MIN_CATALOG_MS,
  normalizeCatalogDurationMs,
  resolveLastFmCatalogDurationMs,
} from "@/lib/lastfm";

/** Next play sooner than this → zero listen credit (row kept for recents). */
export const LASTFM_MIN_SROBBLE_GAP_MS = 10_000;

export type LastFmTimelineRow = {
  id: string;
  trackId: string;
  artistName: string;
  trackName: string;
  playedAt: Date;
  durationMs: number;
};

/** True when the next play starts under {@link LASTFM_MIN_SROBBLE_GAP_MS} (skip / double scrobble). */
export function isLastFmShortGapScrobble(
  playedAt: Date,
  nextPlayedAt: Date | null | undefined
): boolean {
  if (!nextPlayedAt) return false;
  const gap = nextPlayedAt.getTime() - playedAt.getTime();
  return gap < LASTFM_MIN_SROBBLE_GAP_MS;
}

/** @deprecated Use {@link isLastFmShortGapScrobble}. */
export const shouldIgnoreLastFmScrobble = isLastFmShortGapScrobble;

export type LastFmListenNeighbors = {
  prevPlayedAt?: Date | null;
  nextPlayedAt?: Date | null;
};

/**
 * Estimate listen time from timeline gaps (any source), capped at catalog length.
 *
 * - Next play &lt; {@link LASTFM_MIN_SROBBLE_GAP_MS} → 0 (skip / double scrobble).
 * - Otherwise credit the smaller of: catalog, time since previous play, time until next play.
 *   (Both gaps matter: Last.fm `playedAt` is scrobble time, so "since previous" catches
 *   short skips; "until next" catches Spotify-style start timestamps in the same timeline.)
 */
export function inferLastFmListenDurationMs(
  catalogMs: number,
  playedAt: Date,
  neighbors: LastFmListenNeighbors | Date | null | undefined
): number {
  const catalog = normalizeCatalogDurationMs(catalogMs);
  const { prevPlayedAt, nextPlayedAt } =
    neighbors instanceof Date || neighbors == null
      ? { prevPlayedAt: undefined, nextPlayedAt: neighbors ?? undefined }
      : neighbors;

  if (nextPlayedAt) {
    const gapToNext = nextPlayedAt.getTime() - playedAt.getTime();
    if (gapToNext < LASTFM_MIN_SROBBLE_GAP_MS) return 0;
  }

  const candidates: number[] = [catalog];

  if (prevPlayedAt) {
    const gapFromPrev = playedAt.getTime() - prevPlayedAt.getTime();
    if (gapFromPrev >= LASTFM_MIN_SROBBLE_GAP_MS) candidates.push(gapFromPrev);
  }

  if (nextPlayedAt) {
    const gapToNext = nextPlayedAt.getTime() - playedAt.getTime();
    if (gapToNext >= LASTFM_MIN_SROBBLE_GAP_MS) candidates.push(gapToNext);
  }

  return Math.min(...candidates);
}

export type LastFmDurationRecompute = {
  updates: Map<string, number>;
};

export function isLastFmStream(trackId: string): boolean {
  return trackId.startsWith("lfm-");
}

/** Recompute listen durations for Last.fm rows using gaps to the next play. */
export async function recomputeLastFmListenDurations(
  timeline: LastFmTimelineRow[]
): Promise<LastFmDurationRecompute> {
  const updates = new Map<string, number>();
  if (timeline.length === 0) return { updates };

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
      if (row.durationMs >= LASTFM_MIN_CATALOG_MS) {
        catalog = normalizeCatalogDurationMs(row.durationMs);
      } else {
        catalog = await resolveLastFmCatalogDurationMs(row.artistName, row.trackName, catalogCache);
      }
      catalogCache.set(key, catalog);
    }
    catalogByIndex.push(catalog);
  }

  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i];
    if (!isLastFmStream(row.trackId)) continue;

    const listenMs = inferLastFmListenDurationMs(catalogByIndex[i], row.playedAt, {
      prevPlayedAt: sorted[i - 1]?.playedAt ?? null,
      nextPlayedAt: sorted[i + 1]?.playedAt ?? null,
    });
    if (row.durationMs !== listenMs) updates.set(row.id, listenMs);
  }

  return { updates };
}
