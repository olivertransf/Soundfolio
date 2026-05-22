import type { NextRequest } from "next/server";
import { parseTimeRange, parseTopSortBy, type TopSortBy } from "@/lib/stats";
import type { TimeRangeFilter } from "@/lib/stats";
import {
  VIEWER_TIMEZONE_COOKIE,
  VIEWER_TIMEZONE_PARAM,
  resolveStatsTimeZone,
} from "@/lib/stats-timezone";

export type ParsedStatsRequest = {
  filter: TimeRangeFilter;
  sortBy: TopSortBy;
  timeZone: string;
  range?: string;
  from?: string;
  to?: string;
};

export function parseStatsRequestParams(req: NextRequest): ParsedStatsRequest {
  const sp = req.nextUrl.searchParams;
  const range = sp.get("range") ?? undefined;
  const from = sp.get("from") ?? undefined;
  const to = sp.get("to") ?? undefined;
  const timeZone = resolveStatsTimeZone(
    sp.get(VIEWER_TIMEZONE_PARAM) ?? req.cookies.get(VIEWER_TIMEZONE_COOKIE)?.value
  );
  return {
    filter: parseTimeRange(range, from, to, timeZone),
    sortBy: parseTopSortBy(sp.get("sort") ?? undefined),
    timeZone,
    range,
    from,
    to,
  };
}

export function parseStatsLimit(req: NextRequest, defaultLimit = 50, max = 100): number {
  const raw = Number(req.nextUrl.searchParams.get("limit") ?? defaultLimit);
  if (!Number.isFinite(raw)) return defaultLimit;
  return Math.min(Math.max(Math.floor(raw), 1), max);
}

export const STATS_API_CACHE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;
