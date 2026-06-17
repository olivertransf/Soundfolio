import { NextRequest, NextResponse } from "next/server";
import {
  getTotalStats,
  getTopTracks,
  getTopArtists,
  getTopAlbums,
  getLatestPlayAt,
  getListeningDiversity,
  getListeningSpan,
  calendarDaysInFilter,
} from "@/lib/stats";
import { requireAuthenticatedStatsRequest } from "@/lib/stats-api-context";
import { parseStatsRequestParams, STATS_API_CACHE_HEADERS } from "@/lib/stats-api-params";

export async function GET(req: NextRequest) {
  const { denied, userId } = await requireAuthenticatedStatsRequest(req);
  if (denied) return denied;

  const { filter, sortBy, timeZone } = parseStatsRequestParams(req);

  const [
    stats,
    topTracks,
    topArtists,
    topAlbums,
    latestPlayAt,
    diversity,
    span,
  ] = await Promise.all([
    getTotalStats(filter, "me", userId),
    getTopTracks(5, filter, "me", sortBy, userId),
    getTopArtists(5, filter, "me", sortBy, userId),
    getTopAlbums(5, filter, "me", sortBy, userId),
    getLatestPlayAt("me", userId),
    getListeningDiversity(filter, "me", userId),
    getListeningSpan(filter, "me", userId),
  ]);

  const days = calendarDaysInFilter(filter, span, timeZone);
  const avgMinPerDay = stats.totalStreams > 0 ? Math.round(stats.totalMinutes / days) : 0;
  const avgStreamsPerDay = stats.totalStreams > 0 ? Math.round(stats.totalStreams / days) : 0;

  const metrics = [
    {
      label: "Minutes",
      value: stats.totalMinutes.toLocaleString(),
      hint: `${stats.totalHours.toLocaleString()} h`,
    },
    {
      label: "Streams",
      value: stats.totalStreams.toLocaleString(),
    },
    {
      label: "Tracks",
      value: diversity.uniqueTracks.toLocaleString(),
      hint: "unique",
    },
    {
      label: "Artists",
      value: diversity.uniqueArtists.toLocaleString(),
      hint: "unique",
    },
    {
      label: "Min / day",
      value: avgMinPerDay.toLocaleString(),
      hint: `~${days} d`,
    },
    {
      label: "Plays / day",
      value: avgStreamsPerDay.toLocaleString(),
    },
  ];

  return NextResponse.json(
    {
      filter: { label: filter.label },
      sortBy,
      timeZone,
      hasData: stats.totalStreams > 0,
      totals: stats,
      diversity,
      span: span
        ? { first: span.first.toISOString(), last: span.last.toISOString() }
        : null,
      latestPlayAt: latestPlayAt?.toISOString() ?? null,
      calendarDays: days,
      avgMinPerDay,
      avgStreamsPerDay,
      metrics,
      topTracks,
      topArtists,
      topAlbums,
    },
    { headers: STATS_API_CACHE_HEADERS }
  );
}
