import { subDays, subMonths, subWeeks } from "date-fns";
import type { Stream } from "@/lib/types/stream";
import type { TopSortBy } from "@/lib/top-sort";
import {
  resolveStatsTimeZone,
  getHourInTimeZone,
  getListenBucketInstant,
  getDayOfWeekInTimeZone,
  formatCalendarDateInZone,
  startOfCalendarDateInZone,
  endOfCalendarDateInZone,
  startOfYearInZone,
  addCalendarDaysInZone,
  calendarDaysBetweenInZone,
  formatCalendarRangeLabel,
} from "@/lib/stats-timezone";
import { DEFAULT_TIME_RANGE } from "@/lib/time-range";
import {
  albumGroupKey,
  artistGroupKey,
  catalogTrackId,
  isCatalogTrackId,
  matchesEntity,
  normalizeEntityKey,
  pickBetterDisplayName,
  trackGroupKey,
} from "@/lib/entity-normalize";
import { hoursFromMs, minutesFromMs } from "@/lib/listening-minutes";

export type { TopSortBy } from "@/lib/top-sort";
export { parseTopSortBy, TOP_SORT_PARAM, topSortLabel } from "@/lib/top-sort";
export { hoursFromMs, minutesFromMs } from "@/lib/listening-minutes";

const ART_PLACEHOLDER_HASH = "2a96cbd8b46e442fc41c2b86b821562f";

export function isUsableArtUrl(url: string | null | undefined): url is string {
  return Boolean(url && !url.includes(ART_PLACEHOLDER_HASH));
}

export type TimeRangePreset = "30d" | "3m" | "6m" | "1y" | "ytd" | "all";
export { DEFAULT_TIME_RANGE } from "@/lib/time-range";

export interface TimeRangeFilter {
  since?: Date;
  until?: Date;
  label: string;
}

export function parseTimeRange(
  range?: string,
  from?: string,
  to?: string,
  timeZone?: string
): TimeRangeFilter {
  const tz = resolveStatsTimeZone(timeZone);
  const now = new Date();

  if (from && to) {
    let since = startOfCalendarDateInZone(from, tz);
    let until = endOfCalendarDateInZone(to, tz);
    if (!isNaN(since.getTime()) && !isNaN(until.getTime())) {
      if (since > until) {
        since = startOfCalendarDateInZone(to, tz);
        until = endOfCalendarDateInZone(from, tz);
      }
      return { since, until, label: formatCalendarRangeLabel(from, to, tz) };
    }
  }

  switch (range ?? DEFAULT_TIME_RANGE) {
    case "30d":
      return { since: subDays(now, 30), until: now, label: "Last 30 days" };
    case "3m":
      return { since: subMonths(now, 3), until: now, label: "Last 3 months" };
    case "6m":
      return { since: subMonths(now, 6), until: now, label: "Last 6 months" };
    case "1y":
      return { since: subMonths(now, 12), until: now, label: "Last year" };
    case "ytd":
      return { since: startOfYearInZone(now, tz), until: now, label: "This year" };
    case "all":
      return { label: "All time" };
    default:
      return { since: startOfYearInZone(now, tz), until: now, label: "This year" };
  }
}

function inFilter(stream: Stream, filter?: TimeRangeFilter) {
  if (!filter?.since && !filter?.until) return true;
  const playedAt = stream.playedAt.getTime();
  if (filter.since && playedAt < filter.since.getTime()) return false;
  if (filter.until && playedAt > filter.until.getTime()) return false;
  return true;
}

export function filterForStats(streams: Stream[], filter?: TimeRangeFilter) {
  return streams.filter(
    (stream) => !stream.isDemo && stream.durationMs > 0 && inFilter(stream, filter)
  );
}

function topListSort(sortBy: TopSortBy) {
  return sortBy === "streams"
    ? (a: { streams: number }, b: { streams: number }) => b.streams - a.streams
    : (a: { minutesListened: number }, b: { minutesListened: number }) =>
        b.minutesListened - a.minutesListened;
}

export function computeTotalStats(streams: Stream[], filter?: TimeRangeFilter) {
  const rows = filterForStats(streams, filter);
  const totalMs = rows.reduce((sum, row) => sum + row.durationMs, 0);
  return {
    totalStreams: rows.length,
    totalMinutes: minutesFromMs(totalMs),
    totalHours: hoursFromMs(totalMs),
  };
}

export function computeTopTracks(
  streams: Stream[],
  limit = 20,
  filter?: TimeRangeFilter,
  sortBy: TopSortBy = "minutes"
) {
  const rows = filterForStats(streams, filter);
  const groups = new Map<
    string,
    {
      trackId: string;
      trackName: string;
      artistName: string;
      streams: number;
      durationMs: number;
      albumName: string;
      albumArt: string | null;
    }
  >();

  for (const row of rows) {
    const key = trackGroupKey(row.trackId, row.trackName, row.artistName);
    const group = groups.get(key) ?? {
      trackId: row.trackId,
      trackName: row.trackName,
      artistName: row.artistName,
      streams: 0,
      durationMs: 0,
      albumName: row.albumName,
      albumArt: row.albumArt,
    };
    group.streams += 1;
    group.durationMs += row.durationMs;
    group.trackName = pickBetterDisplayName(group.trackName, row.trackName);
    group.artistName = pickBetterDisplayName(group.artistName, row.artistName);
    group.albumName = pickBetterDisplayName(group.albumName, row.albumName);
    if (!group.trackId && isCatalogTrackId(row.trackId)) group.trackId = row.trackId;
    if (!group.albumArt && row.albumArt) {
      group.albumName = pickBetterDisplayName(group.albumName, row.albumName);
      group.albumArt = row.albumArt;
    }
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => ({
      trackId: catalogTrackId(group.trackId, group.trackName, group.artistName),
      trackName: group.trackName,
      artistName: group.artistName,
      albumName: group.albumName,
      albumArt: group.albumArt,
      streams: group.streams,
      minutesListened: minutesFromMs(group.durationMs),
    }))
    .sort(topListSort(sortBy))
    .slice(0, limit);
}

export function computeTopArtists(
  streams: Stream[],
  limit = 20,
  filter?: TimeRangeFilter,
  sortBy: TopSortBy = "minutes"
) {
  const artistArtByKey = new Map<string, string>();
  for (const row of streams) {
    const key = artistGroupKey(row.artistName);
    if (!artistArtByKey.has(key) && isUsableArtUrl(row.artistArt)) {
      artistArtByKey.set(key, row.artistArt);
    }
  }

  const rows = filterForStats(streams, filter);
  const groups = new Map<
    string,
    { artistName: string; streams: number; durationMs: number }
  >();

  for (const row of rows) {
    const key = artistGroupKey(row.artistName);
    const group = groups.get(key) ?? {
      artistName: row.artistName,
      streams: 0,
      durationMs: 0,
    };
    group.streams += 1;
    group.durationMs += row.durationMs;
    group.artistName = pickBetterDisplayName(group.artistName, row.artistName);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([key, group]) => ({
      artistName: group.artistName,
      artistArt: artistArtByKey.get(key) ?? null,
      streams: group.streams,
      minutesListened: minutesFromMs(group.durationMs),
    }))
    .sort(topListSort(sortBy))
    .slice(0, limit);
}

export function computeTopAlbums(
  streams: Stream[],
  limit = 20,
  filter?: TimeRangeFilter,
  sortBy: TopSortBy = "minutes"
) {
  const rows = filterForStats(streams, filter);
  const groups = new Map<
    string,
    { albumName: string; artistName: string; streams: number; durationMs: number; albumArt: string | null }
  >();

  for (const row of rows) {
    const key = albumGroupKey(row.albumName, row.artistName);
    const group = groups.get(key) ?? {
      albumName: row.albumName,
      artistName: row.artistName,
      streams: 0,
      durationMs: 0,
      albumArt: null,
    };
    group.streams += 1;
    group.durationMs += row.durationMs;
    group.albumName = pickBetterDisplayName(group.albumName, row.albumName);
    group.artistName = pickBetterDisplayName(group.artistName, row.artistName);
    if (!group.albumArt && row.albumArt) group.albumArt = row.albumArt;
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => ({
      albumName: group.albumName,
      albumArt: group.albumArt,
      artistName: group.artistName,
      streams: group.streams,
      minutesListened: minutesFromMs(group.durationMs),
    }))
    .sort(topListSort(sortBy))
    .slice(0, limit);
}

export function computeRecentStreams(streams: Stream[], limit = 50) {
  return [...streams]
    .filter((stream) => stream.playedAt <= new Date())
    .sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime())
    .slice(0, limit);
}

export function computeLatestPlayAt(streams: Stream[]) {
  const latest = computeRecentStreams(streams, 1)[0];
  return latest?.playedAt ?? null;
}

export function computeListeningSpan(streams: Stream[], filter?: TimeRangeFilter) {
  const rows = streams.filter((stream) => inFilter(stream, filter));
  if (rows.length === 0) return null;
  const times = rows.map((row) => row.playedAt.getTime());
  return { first: new Date(Math.min(...times)), last: new Date(Math.max(...times)) };
}

export function computeListeningDiversity(streams: Stream[], filter?: TimeRangeFilter) {
  const rows = filterForStats(streams, filter);
  return {
    uniqueTracks: new Set(rows.map((row) => trackGroupKey(row.trackId, row.trackName, row.artistName))).size,
    uniqueArtists: new Set(rows.map((row) => artistGroupKey(row.artistName))).size,
  };
}

export function calendarDaysInFilter(
  filter: TimeRangeFilter,
  span: { first: Date; last: Date } | null,
  timeZone?: string
): number {
  const tz = resolveStatsTimeZone(timeZone);
  if (filter.since && filter.until) {
    return calendarDaysBetweenInZone(
      formatCalendarDateInZone(filter.since, tz),
      formatCalendarDateInZone(filter.until, tz),
      tz
    );
  }
  if (span) {
    return calendarDaysBetweenInZone(
      formatCalendarDateInZone(span.first, tz),
      formatCalendarDateInZone(span.last, tz),
      tz
    );
  }
  return 1;
}

export function computeStreamsByWeek(
  streams: Stream[],
  weeksBack = 26,
  filter?: TimeRangeFilter,
  timeZone?: string
) {
  const tz = resolveStatsTimeZone(timeZone);
  const defaultSince = subWeeks(new Date(), weeksBack);
  const since = filter?.since ?? defaultSince;
  const rows = filterForStats(streams).filter((row) => row.playedAt >= since);
  const byWeek: Record<string, { streams: number; durationMs: number }> = {};

  for (const row of rows) {
    const localDate = formatCalendarDateInZone(row.playedAt, tz);
    const localWeekday = getDayOfWeekInTimeZone(row.playedAt, tz);
    const offsetFromMonday = (localWeekday + 6) % 7;
    const weekStart = addCalendarDaysInZone(localDate, -offsetFromMonday, tz);
    if (!byWeek[weekStart]) byWeek[weekStart] = { streams: 0, durationMs: 0 };
    byWeek[weekStart].streams += 1;
    byWeek[weekStart].durationMs += row.durationMs;
  }

  return Object.entries(byWeek).map(([week, data]) => ({
    week,
    streams: data.streams,
    minutes: minutesFromMs(data.durationMs),
  }));
}

export function computeStreamsByMonth(
  streams: Stream[],
  monthsBack = 12,
  filter?: TimeRangeFilter,
  timeZone?: string
) {
  const tz = resolveStatsTimeZone(timeZone);
  const defaultSince = subMonths(new Date(), monthsBack);
  const since = filter?.since ?? defaultSince;
  const rows = filterForStats(streams).filter((row) => row.playedAt >= since);
  const byMonth: Record<string, { streams: number; durationMs: number }> = {};

  for (const row of rows) {
    const monthKey = formatCalendarDateInZone(row.playedAt, tz).slice(0, 7);
    if (!byMonth[monthKey]) byMonth[monthKey] = { streams: 0, durationMs: 0 };
    byMonth[monthKey].streams += 1;
    byMonth[monthKey].durationMs += row.durationMs;
  }

  return Object.entries(byMonth).map(([month, data]) => ({
    month,
    streams: data.streams,
    minutes: minutesFromMs(data.durationMs),
  }));
}

export function computeStreamsByDay(
  streams: Stream[],
  filter?: TimeRangeFilter,
  timeZone?: string
) {
  const tz = resolveStatsTimeZone(timeZone);
  const defaultSince = subDays(new Date(), 90);
  const since = filter?.since ?? defaultSince;
  const rows = filterForStats(streams).filter((row) => row.playedAt >= since && inFilter(row, filter));
  const byDay: Record<string, { streams: number; durationMs: number }> = {};

  for (const row of rows) {
    const day = formatCalendarDateInZone(row.playedAt, tz);
    if (!byDay[day]) byDay[day] = { streams: 0, durationMs: 0 };
    byDay[day].streams += 1;
    byDay[day].durationMs += row.durationMs;
  }

  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, data]) => ({
      label,
      streams: data.streams,
      minutes: minutesFromMs(data.durationMs),
    }));
}

export function computeStreamsByHour(
  streams: Stream[],
  filter?: TimeRangeFilter,
  timeZone?: string
) {
  const tz = resolveStatsTimeZone(timeZone);
  const rows = filterForStats(streams, filter);
  const byHour: Record<number, { streams: number; durationMs: number }> = {};
  for (let h = 0; h < 24; h++) byHour[h] = { streams: 0, durationMs: 0 };

  for (const row of rows) {
    const instant = getListenBucketInstant(row.playedAt, row.durationMs, row.trackId, tz);
    const h = getHourInTimeZone(instant, tz);
    byHour[h].streams += 1;
    byHour[h].durationMs += row.durationMs;
  }

  return Object.entries(byHour).map(([hour, data]) => ({
    hour: parseInt(hour, 10),
    label: `${hour.toString().padStart(2, "0")}:00`,
    streams: data.streams,
    minutes: minutesFromMs(data.durationMs),
  }));
}

export function computeStreamsByDayOfWeek(
  streams: Stream[],
  filter?: TimeRangeFilter,
  timeZone?: string
) {
  const tz = resolveStatsTimeZone(timeZone);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const rows = filterForStats(streams, filter);
  const byDay: Record<number, { streams: number; durationMs: number }> = {};
  for (let d = 0; d < 7; d++) byDay[d] = { streams: 0, durationMs: 0 };

  for (const row of rows) {
    const instant = getListenBucketInstant(row.playedAt, row.durationMs, row.trackId, tz);
    const d = getDayOfWeekInTimeZone(instant, tz);
    byDay[d].streams += 1;
    byDay[d].durationMs += row.durationMs;
  }

  return [1, 2, 3, 4, 5, 6, 0].map((d) => ({
    day: d,
    label: dayNames[d],
    streams: byDay[d].streams,
    minutes: minutesFromMs(byDay[d].durationMs),
  }));
}

export function computeListeningHeatmap(
  streams: Stream[],
  filter?: TimeRangeFilter,
  timeZone?: string
) {
  const tz = resolveStatsTimeZone(timeZone);
  const rows = filterForStats(streams, filter);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const counts: Record<string, number> = {};
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) counts[`${d}-${h}`] = 0;
  }

  for (const row of rows) {
    const instant = getListenBucketInstant(row.playedAt, row.durationMs, row.trackId, tz);
    const d = getDayOfWeekInTimeZone(instant, tz);
    const h = getHourInTimeZone(instant, tz);
    counts[`${d}-${h}`] += 1;
  }

  const grid: { day: number; hour: number; count: number }[] = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      grid.push({ day: d, hour: h, count: counts[`${d}-${h}`] ?? 0 });
    }
  }

  return { grid, dayNames };
}

export function computePeakHour(
  streams: Stream[],
  filter?: TimeRangeFilter,
  timeZone?: string
) {
  const rows = computeStreamsByHour(streams, filter, timeZone);
  if (rows.length === 0) return null;
  return rows.reduce((best, row) =>
    row.minutes > best.minutes || (row.minutes === best.minutes && row.streams > best.streams)
      ? row
      : best
  );
}

export function computePeakDay(
  streams: Stream[],
  filter?: TimeRangeFilter,
  timeZone?: string
) {
  const rows = computeStreamsByDayOfWeek(streams, filter, timeZone);
  if (rows.length === 0) return null;
  return rows.reduce((best, row) =>
    row.minutes > best.minutes || (row.minutes === best.minutes && row.streams > best.streams)
      ? row
      : best
  );
}

export function formatHourLabel(label: string) {
  const hour = parseInt(label.split(":")[0] ?? "0", 10);
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric" });
}

export function computeTrackDetail(
  streams: Stream[],
  trackName: string,
  artistName: string,
  filter?: TimeRangeFilter
) {
  const rows = filterForStats(streams, filter).filter(
    (row) => matchesEntity(row.trackName, trackName) && matchesEntity(row.artistName, artistName)
  );
  const totalMs = rows.reduce((sum, row) => sum + row.durationMs, 0);
  const dates = rows.map((row) => row.playedAt);
  const trackNameResolved = rows.reduce(
    (current, row) => pickBetterDisplayName(current, row.trackName),
    trackName
  );
  const artistNameResolved = rows.reduce(
    (current, row) => pickBetterDisplayName(current, row.artistName),
    artistName
  );
  return {
    trackName: trackNameResolved,
    artistName: artistNameResolved,
    albumName: rows[0]?.albumName ?? "",
    albumArt: rows.find((row) => row.albumArt)?.albumArt ?? null,
    streams: rows.length,
    minutesListened: minutesFromMs(totalMs),
    firstPlayedAt: dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null,
    lastPlayedAt: dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null,
    recentPlays: [...rows]
      .sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime())
      .slice(0, 20),
  };
}

export function computeArtistDetail(
  streams: Stream[],
  artistName: string,
  filter?: TimeRangeFilter,
  sortBy: TopSortBy = "minutes"
) {
  const rows = filterForStats(streams, filter).filter((row) => matchesEntity(row.artistName, artistName));
  const totalMs = rows.reduce((sum, row) => sum + row.durationMs, 0);
  const artistNameResolved = rows.reduce(
    (current, row) => pickBetterDisplayName(current, row.artistName),
    artistName
  );
  return {
    artistName: artistNameResolved,
    artistArt:
      streams.find(
        (row) =>
          matchesEntity(row.artistName, artistName) && isUsableArtUrl(row.artistArt)
      )?.artistArt ?? null,
    streams: rows.length,
    minutesListened: minutesFromMs(totalMs),
    topTracks: computeTopTracks(rows, 10, filter, sortBy),
    topAlbums: computeTopAlbums(rows, 10, filter, sortBy),
  };
}

export function computeAlbumDetail(
  streams: Stream[],
  albumName: string,
  artistName: string,
  filter?: TimeRangeFilter
) {
  const rows = filterForStats(streams, filter).filter(
    (row) => matchesEntity(row.albumName, albumName) && matchesEntity(row.artistName, artistName)
  );
  const totalMs = rows.reduce((sum, row) => sum + row.durationMs, 0);
  const trackGroups = new Map<string, { trackName: string; streams: number; durationMs: number }>();
  for (const row of rows) {
    const key = normalizeEntityKey(row.trackName);
    const group = trackGroups.get(key) ?? { trackName: row.trackName, streams: 0, durationMs: 0 };
    group.streams += 1;
    group.durationMs += row.durationMs;
    group.trackName = pickBetterDisplayName(group.trackName, row.trackName);
    trackGroups.set(key, group);
  }
  const albumNameResolved = rows.reduce(
    (current, row) => pickBetterDisplayName(current, row.albumName),
    albumName
  );
  const artistNameResolved = rows.reduce(
    (current, row) => pickBetterDisplayName(current, row.artistName),
    artistName
  );
  return {
    albumName: albumNameResolved,
    artistName: artistNameResolved,
    albumArt: rows.find((row) => row.albumArt)?.albumArt ?? null,
    streams: rows.length,
    minutesListened: minutesFromMs(totalMs),
    tracks: [...trackGroups.values()]
      .map((group) => ({
        trackName: group.trackName,
        streams: group.streams,
        minutes: minutesFromMs(group.durationMs),
      }))
      .sort((a, b) => b.streams - a.streams),
  };
}
