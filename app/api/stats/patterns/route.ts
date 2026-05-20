import { NextRequest, NextResponse } from "next/server";
import {
  getListeningHeatmap,
  getStreamsByDayOfWeek,
  getStreamsByHour,
  parseTimeRange,
} from "@/lib/stats";
import { VIEWER_TIMEZONE_PARAM, resolveStatsTimeZone } from "@/lib/stats-timezone";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const range = sp.get("range") ?? undefined;
  const from = sp.get("from") ?? undefined;
  const to = sp.get("to") ?? undefined;
  const timeZone = resolveStatsTimeZone(sp.get(VIEWER_TIMEZONE_PARAM));

  const filter = parseTimeRange(range, from, to, timeZone);
  const [byHour, byDay, heatmap] = await Promise.all([
    getStreamsByHour(filter, "me", timeZone),
    getStreamsByDayOfWeek(filter, "me", timeZone),
    getListeningHeatmap(filter, "me", timeZone),
  ]);

  return NextResponse.json({
    timeZone,
    byHour,
    byDay,
    heatmap,
  });
}
