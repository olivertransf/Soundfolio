import { NextRequest, NextResponse } from "next/server";
import {
  getStreamsByWeek,
  getStreamsByMonth,
  getStreamsByDay,
  parseTimeRange,
} from "@/lib/stats";
import { requireAuthenticatedStatsRequest } from "@/lib/stats-api-context";
import {
  VIEWER_TIMEZONE_COOKIE,
  VIEWER_TIMEZONE_PARAM,
  resolveStatsTimeZone,
} from "@/lib/stats-timezone";

export async function GET(req: NextRequest) {
  const { denied, userId } = await requireAuthenticatedStatsRequest(req);
  if (denied) return denied;

  const mode = req.nextUrl.searchParams.get("mode") ?? "months";
  const range = req.nextUrl.searchParams.get("range") ?? undefined;
  const from = req.nextUrl.searchParams.get("from") ?? undefined;
  const to = req.nextUrl.searchParams.get("to") ?? undefined;
  const timeZone = resolveStatsTimeZone(
    req.nextUrl.searchParams.get(VIEWER_TIMEZONE_PARAM) ?? req.cookies.get(VIEWER_TIMEZONE_COOKIE)?.value
  );
  const filter = parseTimeRange(range, from, to, timeZone);

  if (mode === "weeks") {
    const raw = await getStreamsByWeek(26, filter, "me", timeZone, userId);
    const data = raw.map((d) => ({
      label: d.week,
      minutes: d.minutes,
      streams: d.streams,
    }));
    return NextResponse.json({ data });
  }

  if (mode === "days") {
    const raw = await getStreamsByDay(filter, "me", timeZone, userId);
    const data = raw.map((d) => ({
      label: d.label,
      minutes: d.minutes,
      streams: d.streams,
    }));
    return NextResponse.json({ data });
  }

  const raw = await getStreamsByMonth(12, filter, "me", timeZone, userId);
  const data = raw.map((d) => ({
    label: d.month,
    minutes: d.minutes,
    streams: d.streams,
  }));
  return NextResponse.json({ data });
}
