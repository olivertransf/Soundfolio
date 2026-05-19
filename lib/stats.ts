import { db } from "@/lib/db";
import {
  subMonths,
  subWeeks,
  subDays,
  format,
  parse,
  differenceInCalendarDays,
} from "date-fns";
import { DEFAULT_TIME_RANGE } from "@/lib/time-range";
import type { TopSortBy } from "@/lib/top-sort";
import {
  resolveStatsTimeZone,
  getHourInTimeZone,
  getDayOfWeekInTimeZone,
  formatCalendarDateInZone,
  startOfCalendarDateInZone,
  endOfCalendarDateInZone,
  startOfYearInZone,
} from "@/lib/stats-timezone";

export type { TopSortBy } from "@/lib/top-sort";
export { parseTopSortBy, TOP_SORT_PARAM, topSortLabel } from "@/lib/top-sort";

function topListOrderBy(sortBy: TopSortBy) {
  return sortBy === "streams"
    ? { _count: { id: "desc" as const } }
    : { _sum: { durationMs: "desc" as const } };
}

export type TimeRangePreset = "30d" | "3m" | "6m" | "1y" | "ytd" | "all";

export { DEFAULT_TIME_RANGE } from "@/lib/time-range";

export interface TimeRangeFilter {
  since?: Date;
  until?: Date;
  label: string;
}

/** `me` = real library; `demo` = seeded preview rows (`isDemo: true`). */
export type StatsScope = "me" | "demo";

type StreamWhere = {
  playedAt?: { gte?: Date; lte?: Date };
  isDemo?: boolean;
  artistName?: string | { in?: string[] };
  artistArt?: string | null | { not?: null };
  albumArt?: string | null | { not?: null };
  trackId?: string | { in?: string[] };
  albumName?: string;
  OR?: StreamWhere[];
};

function mergeScope(base: StreamWhere, scope: StatsScope): StreamWhere {
  return { ...base, isDemo: scope === "demo" };
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
    // HTML date inputs are yyyy-MM-dd; `new Date("yyyy-MM-dd")` is UTC midnight and shifts the calendar day in local timezones.
    let since = startOfCalendarDateInZone(from, tz);
    let until = endOfCalendarDateInZone(to, tz);
    if (!isNaN(since.getTime()) && !isNaN(until.getTime())) {
      if (since > until) {
        since = startOfCalendarDateInZone(to, tz);
        until = endOfCalendarDateInZone(from, tz);
      }
      return {
        since,
        until,
        label: `${format(since, "MMM d, yyyy")} – ${format(until, "MMM d, yyyy")}`,
      };
    }
  }

  switch (range ?? DEFAULT_TIME_RANGE) {
    case "30d":
      return {
        since: subDays(now, 30),
        until: now,
        label: "Last 30 days",
      };
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
      return {
        since: startOfYearInZone(now, tz),
        until: now,
        label: "This year",
      };
  }
}

function buildWhere(filter: TimeRangeFilter) {
  const where: { playedAt?: { gte?: Date; lte?: Date } } = {};
  if (filter.since) where.playedAt = { ...where.playedAt, gte: filter.since };
  where.playedAt = { ...where.playedAt, lte: filter.until ?? new Date() };
  return Object.keys(where).length ? where : {};
}

/** Date filter for queries: all-time uses `{}`; missing filter uses `fallbackSince`. */
function resolveDateWhere(
  filter: TimeRangeFilter | undefined,
  fallbackSince: Date
) {
  if (!filter) return { playedAt: { gte: fallbackSince, lte: new Date() } };
  if (filter.since || filter.until) return buildWhere(filter);
  return {};
}

export async function getTotalStats(
  filter?: TimeRangeFilter,
  scope: StatsScope = "me"
) {
  const where = mergeScope(filter ? buildWhere(filter) : {}, scope);

  const result = await db.stream.aggregate({
    where,
    _sum: { durationMs: true },
    _count: { id: true },
  });

  const totalMs = result._sum.durationMs ?? 0;
  return {
    totalStreams: result._count.id,
    totalMinutes: Math.round(totalMs / 60000),
    totalHours: Math.round(totalMs / 3600000),
  };
}

export async function getTopTracks(
  limit = 20,
  filter?: TimeRangeFilter,
  scope: StatsScope = "me",
  sortBy: TopSortBy = "minutes"
) {
  const where = mergeScope(filter ? buildWhere(filter) : {}, scope);

  const tracks = await db.stream.groupBy({
    by: ["trackId", "trackName", "artistName"],
    where,
    _count: { id: true },
    _sum: { durationMs: true },
    orderBy: topListOrderBy(sortBy),
    take: limit,
  });

  const trackIds = tracks.map((t) => t.trackId);
  const albumMeta = new Map<string, { albumName: string; albumArt: string | null }>();
  if (trackIds.length > 0) {
    const metaRows = await db.stream.findMany({
      where: mergeScope({ trackId: { in: trackIds } }, scope),
      select: { trackId: true, albumName: true, albumArt: true, playedAt: true },
      orderBy: { playedAt: "desc" },
    });
    for (const row of metaRows) {
      if (!albumMeta.has(row.trackId)) {
        albumMeta.set(row.trackId, { albumName: row.albumName, albumArt: row.albumArt });
      }
    }
  }

  return tracks.map((t) => {
    const album = albumMeta.get(t.trackId);
    return {
      trackId: t.trackId,
      trackName: t.trackName,
      artistName: t.artistName,
      albumName: album?.albumName ?? "",
      albumArt: album?.albumArt ?? null,
      streams: t._count.id,
      minutesListened: Math.round((t._sum.durationMs ?? 0) / 60000),
    };
  });
}

export async function getTopArtists(
  limit = 20,
  filter?: TimeRangeFilter,
  scope: StatsScope = "me",
  sortBy: TopSortBy = "minutes"
) {
  const where = mergeScope(filter ? buildWhere(filter) : {}, scope);

  const artists = await db.stream.groupBy({
    by: ["artistName"],
    where,
    _count: { id: true },
    _sum: { durationMs: true },
    orderBy: topListOrderBy(sortBy),
    take: limit,
  });

  const names = artists.map((a) => a.artistName);
  const PLACEHOLDER = "2a96cbd8b46e442fc41c2b86b821562f";
  let artMap = new Map<string, string | null>();
  if (names.length > 0) {
    const artRows = await db.stream.findMany({
      where: mergeScope(
        { artistName: { in: names }, artistArt: { not: null } },
        scope
      ),
      select: { artistName: true, artistArt: true },
      distinct: ["artistName"],
    });
    artMap = new Map(
      artRows
        .filter((r) => r.artistArt && !r.artistArt.includes(PLACEHOLDER))
        .map((r) => [r.artistName, r.artistArt!])
    );
  }

  return artists.map((a) => ({
    artistName: a.artistName,
    artistArt: artMap.get(a.artistName) ?? null,
    streams: a._count.id,
    minutesListened: Math.round((a._sum.durationMs ?? 0) / 60000),
  }));
}

export async function getRecentStreams(
  limit = 50,
  scope: StatsScope = "me"
) {
  return db.stream.findMany({
    where: mergeScope({ playedAt: { lte: new Date() } }, scope),
    orderBy: { playedAt: "desc" },
    take: limit,
  });
}

export async function getTopAlbums(
  limit = 20,
  filter?: TimeRangeFilter,
  scope: StatsScope = "me",
  sortBy: TopSortBy = "minutes"
) {
  const where = mergeScope(filter ? buildWhere(filter) : {}, scope);

  const albums = await db.stream.groupBy({
    by: ["albumName", "artistName"],
    where,
    _count: { id: true },
    _sum: { durationMs: true },
    orderBy: topListOrderBy(sortBy),
    take: limit,
  });

  const albumArt = new Map<string, string | null>();
  if (albums.length > 0) {
    const artRows = await db.stream.findMany({
      where: mergeScope(
        {
          OR: albums.map((a) => ({
            albumName: a.albumName,
            artistName: a.artistName,
            albumArt: { not: null },
          })),
        },
        scope
      ),
      select: { albumName: true, artistName: true, albumArt: true, playedAt: true },
      orderBy: { playedAt: "desc" },
    });
    for (const row of artRows) {
      const key = `${row.albumName}\0${row.artistName}`;
      if (!albumArt.has(key)) albumArt.set(key, row.albumArt);
    }
  }

  return albums.map((a) => {
    const key = `${a.albumName}\0${a.artistName}`;
    return {
      albumName: a.albumName,
      albumArt: albumArt.get(key) ?? null,
      artistName: a.artistName,
      streams: a._count.id,
      minutesListened: Math.round((a._sum.durationMs ?? 0) / 60000),
    };
  });
}

export async function getStreamsByHour(
  filter?: TimeRangeFilter,
  scope: StatsScope = "me",
  timeZone?: string
) {
  const tz = resolveStatsTimeZone(timeZone);
  const where = mergeScope(filter ? buildWhere(filter) : {}, scope);
  const streams = await db.stream.findMany({
    where,
    select: { playedAt: true, durationMs: true },
  });

  const byHour: Record<number, { streams: number; minutes: number }> = {};
  for (let h = 0; h < 24; h++) byHour[h] = { streams: 0, minutes: 0 };

  for (const s of streams) {
    const h = getHourInTimeZone(s.playedAt, tz);
    byHour[h].streams++;
    byHour[h].minutes += Math.round(s.durationMs / 60000);
  }

  return Object.entries(byHour).map(([hour, data]) => ({
    hour: parseInt(hour, 10),
    label: `${hour.toString().padStart(2, "0")}:00`,
    ...data,
  }));
}

export async function getStreamsByDayOfWeek(
  filter?: TimeRangeFilter,
  scope: StatsScope = "me",
  timeZone?: string
) {
  const tz = resolveStatsTimeZone(timeZone);
  const where = mergeScope(filter ? buildWhere(filter) : {}, scope);
  const streams = await db.stream.findMany({
    where,
    select: { playedAt: true, durationMs: true },
  });

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const byDay: Record<number, { streams: number; minutes: number }> = {};
  for (let d = 0; d < 7; d++) byDay[d] = { streams: 0, minutes: 0 };

  for (const s of streams) {
    const d = getDayOfWeekInTimeZone(s.playedAt, tz);
    byDay[d].streams++;
    byDay[d].minutes += Math.round(s.durationMs / 60000);
  }

  return [1, 2, 3, 4, 5, 6, 0].map((d) => ({
    day: d,
    label: dayNames[d],
    ...byDay[d],
  }));
}

export async function getListeningHeatmap(
  filter?: TimeRangeFilter,
  scope: StatsScope = "me",
  timeZone?: string
) {
  const tz = resolveStatsTimeZone(timeZone);
  const where = mergeScope(filter ? buildWhere(filter) : {}, scope);
  const streams = await db.stream.findMany({
    where,
    select: { playedAt: true },
  });

  const grid: { day: number; hour: number; count: number }[] = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const counts: Record<string, number> = {};
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      counts[`${d}-${h}`] = 0;
    }
  }

  for (const s of streams) {
    const d = getDayOfWeekInTimeZone(s.playedAt, tz);
    const h = getHourInTimeZone(s.playedAt, tz);
    counts[`${d}-${h}`]++;
  }

  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      grid.push({ day: d, hour: h, count: counts[`${d}-${h}`] ?? 0 });
    }
  }

  return { grid, dayNames };
}

export async function getStreamsByWeek(
  weeksBack = 26,
  filter?: TimeRangeFilter,
  scope: StatsScope = "me",
  timeZone?: string
) {
  const tz = resolveStatsTimeZone(timeZone);
  const defaultSince = subWeeks(new Date(), weeksBack);
  const where = mergeScope(resolveDateWhere(filter, defaultSince), scope);
  const streams = await db.stream.findMany({
    where,
    select: { playedAt: true, durationMs: true },
    orderBy: { playedAt: "asc" },
  });

  const byWeek: Record<string, { streams: number; minutes: number }> = {};

  for (const s of streams) {
    const localDate = formatCalendarDateInZone(s.playedAt, tz);
    const localWeekday = getDayOfWeekInTimeZone(s.playedAt, tz);
    const offsetFromMonday = (localWeekday + 6) % 7;
    const weekStart = format(
      subDays(parse(localDate, "yyyy-MM-dd", new Date()), offsetFromMonday),
      "yyyy-MM-dd"
    );
    if (!byWeek[weekStart]) byWeek[weekStart] = { streams: 0, minutes: 0 };
    byWeek[weekStart].streams++;
    byWeek[weekStart].minutes += Math.round(s.durationMs / 60000);
  }

  return Object.entries(byWeek).map(([week, data]) => ({ week, ...data }));
}

export async function getStreamsByMonth(
  monthsBack = 12,
  filter?: TimeRangeFilter,
  scope: StatsScope = "me",
  timeZone?: string
) {
  const tz = resolveStatsTimeZone(timeZone);
  const defaultSince = subMonths(new Date(), monthsBack);
  const where = mergeScope(resolveDateWhere(filter, defaultSince), scope);
  const streams = await db.stream.findMany({
    where,
    select: { playedAt: true, durationMs: true },
    orderBy: { playedAt: "asc" },
  });

  const byMonth: Record<string, { streams: number; minutes: number }> = {};

  for (const s of streams) {
    const monthKey = formatCalendarDateInZone(s.playedAt, tz).slice(0, 7);
    if (!byMonth[monthKey]) byMonth[monthKey] = { streams: 0, minutes: 0 };
    byMonth[monthKey].streams++;
    byMonth[monthKey].minutes += Math.round(s.durationMs / 60000);
  }

  return Object.entries(byMonth).map(([month, data]) => ({ month, ...data }));
}

export async function getStreamsByDay(
  filter?: TimeRangeFilter,
  scope: StatsScope = "me",
  timeZone?: string
) {
  const tz = resolveStatsTimeZone(timeZone);
  const defaultSince = subDays(new Date(), 90);
  const where = mergeScope(resolveDateWhere(filter, defaultSince), scope);
  const streams = await db.stream.findMany({
    where,
    select: { playedAt: true, durationMs: true },
    orderBy: { playedAt: "asc" },
  });

  const byDay: Record<string, { streams: number; minutes: number }> = {};
  for (const s of streams) {
    const day = formatCalendarDateInZone(s.playedAt, tz);
    if (!byDay[day]) byDay[day] = { streams: 0, minutes: 0 };
    byDay[day].streams++;
    byDay[day].minutes += Math.round(s.durationMs / 60000);
  }

  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, data]) => ({ label, ...data }));
}

export async function getListeningSpan(
  filter?: TimeRangeFilter,
  scope: StatsScope = "me"
) {
  const base = filter
    ? filter.since || filter.until
      ? buildWhere(filter)
      : {}
    : {};
  const where = mergeScope(base, scope);
  const agg = await db.stream.aggregate({
    where,
    _min: { playedAt: true },
    _max: { playedAt: true },
  });
  if (!agg._min.playedAt || !agg._max.playedAt) return null;
  return { first: agg._min.playedAt, last: agg._max.playedAt };
}

/** Calendar days covered by the filter (for averages). All-time uses first→last play in data. */
export function calendarDaysInFilter(
  filter: TimeRangeFilter,
  span: { first: Date; last: Date } | null
): number {
  if (filter.since && filter.until) {
    return Math.max(1, differenceInCalendarDays(filter.until, filter.since) + 1);
  }
  if (span) {
    return Math.max(1, differenceInCalendarDays(span.last, span.first) + 1);
  }
  return 1;
}

export async function getListeningDiversity(
  filter?: TimeRangeFilter,
  scope: StatsScope = "me"
) {
  const base = filter
    ? filter.since || filter.until
      ? buildWhere(filter)
      : {}
    : {};
  const where = mergeScope(base, scope);
  const [tracks, artists] = await Promise.all([
    db.stream.groupBy({
      by: ["trackId"],
      where,
      _count: { _all: true },
    }),
    db.stream.groupBy({
      by: ["artistName"],
      where,
      _count: { _all: true },
    }),
  ]);
  return { uniqueTracks: tracks.length, uniqueArtists: artists.length };
}

export async function getActivityHeatmap(scope: StatsScope = "me", timeZone?: string) {
  const tz = resolveStatsTimeZone(timeZone);
  const since = subMonths(new Date(), 12);
  const streams = await db.stream.findMany({
    where: mergeScope({ playedAt: { gte: since } }, scope),
    select: { playedAt: true },
  });

  const byDay: Record<string, number> = {};
  for (const s of streams) {
    const day = formatCalendarDateInZone(s.playedAt, tz);
    byDay[day] = (byDay[day] ?? 0) + 1;
  }

  return byDay;
}

/** Most recent `playedAt` in the DB (latest listen), not “when Last.fm sync last ran”. */
export async function getLatestPlayAt(
  scope: StatsScope = "me"
): Promise<Date | null> {
  const latest = await db.stream.findFirst({
    where: mergeScope({ playedAt: { lte: new Date() } }, scope),
    orderBy: { playedAt: "desc" },
    select: { playedAt: true },
  });
  return latest?.playedAt ?? null;
}

