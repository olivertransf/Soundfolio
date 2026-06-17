import { NextRequest, NextResponse } from "next/server";
import {
  getListeningHeatmap,
  getStreamsByDayOfWeek,
  getStreamsByHour,
  parseTimeRange,
} from "@/lib/stats";
import { requireAuthenticatedStatsRequest } from "@/lib/stats-api-context";
import { VIEWER_TIMEZONE_PARAM, resolveStatsTimeZone } from "@/lib/stats-timezone";

export async function GET(req: NextRequest) {
  const { denied, userId } = await requireAuthenticatedStatsRequest(req);
  if (denied) return denied;

  const sp = req.nextUrl.searchParams;
  const range = sp.get("range") ?? undefined;
  const from = sp.get("from") ?? undefined;
  const to = sp.get("to") ?? undefined;
  const timeZone = resolveStatsTimeZone(sp.get(VIEWER_TIMEZONE_PARAM));

  const filter = parseTimeRange(range, from, to, timeZone);
  const [byHour, byDay, heatmap] = await Promise.all([
    getStreamsByHour(filter, "me", timeZone, userId),
    getStreamsByDayOfWeek(filter, "me", timeZone, userId),
    getListeningHeatmap(filter, "me", timeZone, userId),
  ]);

  return NextResponse.json(
    {
      timeZone,
      byHour,
      byDay,
      heatmap,
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    }
  );
}
