import type { Stream } from "@/lib/types/stream";
import {
  computeStreamsByDay,
  computeStreamsByMonth,
  computeStreamsByWeek,
  parseTimeRange,
  type TimeRangeFilter,
} from "@/lib/stats-compute";

export type ChartPoint = {
  label: string;
  minutes: number;
  streams: number;
};

export function historyChartData(
  streams: Stream[],
  mode: "months" | "weeks" | "days",
  filter: TimeRangeFilter,
  timeZone: string
): ChartPoint[] {
  if (mode === "weeks") {
    return computeStreamsByWeek(streams, 26, filter, timeZone).map((row) => ({
      label: row.week,
      minutes: row.minutes,
      streams: row.streams,
    }));
  }
  if (mode === "days") {
    return computeStreamsByDay(streams, filter, timeZone).map((row) => ({
      label: row.label,
      minutes: row.minutes,
      streams: row.streams,
    }));
  }
  return computeStreamsByMonth(streams, 12, filter, timeZone).map((row) => ({
    label: row.month,
    minutes: row.minutes,
    streams: row.streams,
  }));
}

export function parseChartFilter(
  range: string,
  from: string,
  to: string,
  timeZone: string
) {
  return parseTimeRange(range || undefined, from || undefined, to || undefined, timeZone);
}
