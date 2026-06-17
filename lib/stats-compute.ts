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

export type { TopSortBy } from "@/lib/top-sort";
export { parseTopSortBy, TOP_SORT_PARAM, topSortLabel } from "@/lib/top-sort";

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
  return streams.filter((stream) => stream.durationMs > 0 && inFilter(stream, filter));
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
    totalMinutes: Math.round(totalMs / 60000),
    totalHours: Math.round(totalMs / 3600000),
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
    { trackName: string; artistName: string; streams: number; durationMs: number; albumName: string; albumArt: string | null }
  >();

  for (const row of rows) {
    const key = `${row.trackName}\0${row.artistName}`;
    const group = groups.get(key) ?? {
      trackName: row.trackName,
      artistName: row.artistName,
      streams: 0,
      durationMs: 0,
      albumName: row.albumName,
      albumArt: row.albumArt,
    };
    group.streams += 1;
    group.durationMs += row.durationMs;
    if (!group.albumArt && row.albumArt) {
      group.albumName = row.albumName;
      group.albumArt = row.albumArt;
    }
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => ({
      trackId: `${group.trackName}\0${group.artistName}`,
      trackName: group.trackName,
      artistName: group.artistName,
      albumName: group.albumName,
      albumArt: group.albumArt,
      streams: group.streams,
      minutesListened: Math.round(group.durationMs / 60000),
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
  const PLACEHOLDER = "2a96cbd8b46e442fc41c2b86b821562f";
  const rows = filterForStats(streams, filter);
  const groups = new Map<string, { artistName: string; streams: number; durationMs: number; artistArt: string | null }>();

  for (const row of rows) {
    const group = groups.get(row.artistName) ?? {
      artistName: row.artistName,
      streams: 0,
      durationMs: 0,
      artistArt: null,
    };
    group.streams += 1;
    group.durationMs += row.durationMs;
    if (
      row.artistArt &&
      !row.artistArt.includes(PLACEHOLDER) &&
      !group.artistArt
    ) {
      group.artistArt = row.artistArt;
    }
    groups.set(row.artistName, group);
  }

  return [...groups.values()]
    .map((group) => ({
      artistName: group.artistName,
      artistArt: group.artistArt,
      streams: group.streams,
      minutesListened: Math.round(group.durationMs / 60000),
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
    const key = `${row.albumName}\0${row.artistName}`;
    const group = groups.get(key) ?? {
      albumName: row.albumName,
      artistName: row.artistName,
      streams: 0,
      durationMs: 0,
      albumArt: null,
    };
    group.streams += 1;
    group.durationMs += row.durationMs;
    if (!group.albumArt && row.albumArt) group.albumArt = row.albumArt;
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => ({
      albumName: group.albumName,
      albumArt: group.albumArt,
      artistName: group.artistName,
      streams: group.streams,
      minutesListened: Math.round(group.durationMs / 60000),
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
    uniqueTracks: new Set(rows.map((row) => row.trackId)).size,
    uniqueArtists: new Set(rows.map((row) => row.artistName)).size,
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
  const byWeek: Record<string, { streams: number; minutes: number }> = {};

  for (const row of rows) {
    const localDate = formatCalendarDateInZone(row.playedAt, tz);
    const localWeekday = getDayOfWeekInTimeZone(row.playedAt, tz);
    const offsetFromMonday = (localWeekday + 6) % 7;
    const weekStart = addCalendarDaysInZone(localDate, -offsetFromMonday, tz);
    if (!byWeek[weekStart]) byWeek[weekStart] = { streams: 0, minutes: 0 };
    byWeek[weekStart].streams += 1;
    byWeek[weekStart].minutes += Math.round(row.durationMs / 60000);
  }

  return Object.entries(byWeek).map(([week, data]) => ({ week, ...data }));
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
  const byMonth: Record<string, { streams: number; minutes: number }> = {};

  for (const row of rows) {
    const monthKey = formatCalendarDateInZone(row.playedAt, tz).slice(0, 7);
    if (!byMonth[monthKey]) byMonth[monthKey] = { streams: 0, minutes: 0 };
    byMonth[monthKey].streams += 1;
    byMonth[monthKey].minutes += Math.round(row.durationMs / 60000);
  }

  return Object.entries(byMonth).map(([month, data]) => ({ month, ...data }));
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
  const byDay: Record<string, { streams: number; minutes: number }> = {};

  for (const row of rows) {
    const day = formatCalendarDateInZone(row.playedAt, tz);
    if (!byDay[day]) byDay[day] = { streams: 0, minutes: 0 };
    byDay[day].streams += 1;
    byDay[day].minutes += Math.round(row.durationMs / 60000);
  }

  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, data]) => ({ label, ...data }));
}

export function computeStreamsByHour(
  streams: Stream[],
  filter?: TimeRangeFilter,
  timeZone?: string
) {
  const tz = resolveStatsTimeZone(timeZone);
  const rows = filterForStats(streams, filter);
  const byHour: Record<number, { streams: number; minutes: number }> = {};
  for (let h = 0; h < 24; h++) byHour[h] = { streams: 0, minutes: 0 };

  for (const row of rows) {
    const instant = getListenBucketInstant(row.playedAt, row.durationMs, row.trackId, tz);
    const h = getHourInTimeZone(instant, tz);
    byHour[h].streams += 1;
    byHour[h].minutes += Math.round(row.durationMs / 60000);
  }

  return Object.entries(byHour).map(([hour, data]) => ({
    hour: parseInt(hour, 10),
    label: `${hour.toString().padStart(2, "0")}:00`,
    ...data,
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
  const byDay: Record<number, { streams: number; minutes: number }> = {};
  for (let d = 0; d < 7; d++) byDay[d] = { streams: 0, minutes: 0 };

  for (const row of rows) {
    const instant = getListenBucketInstant(row.playedAt, row.durationMs, row.trackId, tz);
    const d = getDayOfWeekInTimeZone(instant, tz);
    byDay[d].streams += 1;
    byDay[d].minutes += Math.round(row.durationMs / 60000);
  }

  return [1, 2, 3, 4, 5, 6, 0].map((d) => ({
    day: d,
    label: dayNames[d],
    ...byDay[d],
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
