import {
  isLastFmPlaceholderUrl,
  lastFmDefaultDurationMs,
  resolveLastFmCatalogDurationMs,
} from "@/lib/lastfm";
import { cleanEntityLabel, normalizeEntityKey } from "@/lib/entity-normalize";
import { lastFmScrobbleStreamId, scrobbleIdentityKey } from "@/lib/stream-ids";
import { correctLastFmPlayedAt, resolveStatsTimeZone } from "@/lib/stats-timezone";
import type { StreamInput } from "@/lib/types/stream";

export type IncomingScrobble = {
  artist: string;
  name: string;
  album: string;
  playedAt: Date;
  image: string | null;
};

export type InsertLastFmOptions = {
  /**
   * Skip Last.fm track.getInfo and store the default duration.
   * Prefer false so minutes use real catalog lengths.
   */
  fast?: boolean;
  /** Known dedicated artist image URLs keyed by normalized artist name. */
  artistArtByKey?: Map<string, string>;
  /** Shared catalog-duration cache across sync batches. */
  durationCache?: Map<string, number>;
};

const DURATION_RESOLVE_CONCURRENCY = 5;

export async function prepareLastFmScrobbleStreams(
  novel: IncomingScrobble[],
  timeZone?: string,
  options?: InsertLastFmOptions
): Promise<StreamInput[]> {
  if (novel.length === 0) return [];

  const tz = resolveStatsTimeZone(timeZone);
  const normalized = novel.map((t) => ({
    ...t,
    playedAt: correctLastFmPlayedAt(t.playedAt, tz),
  }));
  const sorted = [...normalized].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  const defaultDurationMs = lastFmDefaultDurationMs();
  const artistArtByKey = options?.artistArtByKey;
  const durationCache = options?.durationCache ?? new Map<string, number>();

  if (!options?.fast) {
    const unique = new Map<string, { artist: string; track: string }>();
    for (const t of sorted) {
      const artist = cleanEntityLabel(t.artist);
      const track = cleanEntityLabel(t.name);
      const key = `${artist}\0${track}`;
      if (!unique.has(key) && !durationCache.has(key)) {
        unique.set(key, { artist, track });
      }
    }

    const list = [...unique.values()];
    for (let i = 0; i < list.length; i += DURATION_RESOLVE_CONCURRENCY) {
      const batch = list.slice(i, i + DURATION_RESOLVE_CONCURRENCY);
      await Promise.all(
        batch.map(({ artist, track }) =>
          resolveLastFmCatalogDurationMs(artist, track, durationCache)
        )
      );
    }
  }

  return sorted.map((t) => {
    const artistName = cleanEntityLabel(t.artist);
    const trackName = cleanEntityLabel(t.name);
    const artKey = normalizeEntityKey(artistName);
    const durationKey = `${artistName}\0${trackName}`;
    return {
      trackId: lastFmScrobbleStreamId(t.artist, t.name, t.playedAt),
      trackName,
      artistName,
      artistArt: artistArtByKey?.get(artKey) ?? null,
      albumName: cleanEntityLabel(t.album),
      albumArt: t.image && !isLastFmPlaceholderUrl(t.image) ? t.image : null,
      durationMs: options?.fast
        ? defaultDurationMs
        : (durationCache.get(durationKey) ?? defaultDurationMs),
      playedAt: t.playedAt,
      isDemo: false,
    };
  });
}

export function filterNovelScrobbles(
  tracks: IncomingScrobble[],
  existing: { artistName: string; trackName: string; playedAt: Date }[]
) {
  const seen = new Set(
    existing.map((row) => scrobbleIdentityKey(row.artistName, row.trackName, row.playedAt))
  );
  return tracks.filter((t) => !seen.has(scrobbleIdentityKey(t.artist, t.name, t.playedAt)));
}

export function filterNovelAgainstExisting(
  tracks: IncomingScrobble[],
  existing: { artistName: string; trackName: string; playedAt: Date }[]
) {
  return filterNovelScrobbles(tracks, existing);
}
