import {
  isLastFmPlaceholderUrl,
  lastFmDefaultDurationMs,
} from "@/lib/lastfm";
import { cleanEntityLabel } from "@/lib/entity-normalize";
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
  fast?: boolean;
};

export function prepareLastFmScrobbleStreams(
  novel: IncomingScrobble[],
  timeZone?: string,
  options?: InsertLastFmOptions
): StreamInput[] {
  if (novel.length === 0) return [];

  const tz = resolveStatsTimeZone(timeZone);
  const normalized = novel.map((t) => ({
    ...t,
    playedAt: correctLastFmPlayedAt(t.playedAt, tz),
  }));
  const sorted = [...normalized].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  const defaultDurationMs = lastFmDefaultDurationMs();

  return sorted.map((t) => ({
    trackId: lastFmScrobbleStreamId(t.artist, t.name, t.playedAt),
    trackName: cleanEntityLabel(t.name),
    artistName: cleanEntityLabel(t.artist),
    artistArt: null,
    albumName: cleanEntityLabel(t.album),
    albumArt: t.image && !isLastFmPlaceholderUrl(t.image) ? t.image : null,
    durationMs: options?.fast === false ? defaultDurationMs : defaultDurationMs,
    playedAt: t.playedAt,
    isDemo: false,
  }));
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
