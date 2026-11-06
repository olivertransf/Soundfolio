import { getHourInTimeZone } from "./stats-timezone";
import type { Archive, ArchivePeriod } from "./archive-analytics";

export type LabMetric = "plays" | "time";
export type LabTotals = { plays: number; ms: number };
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const HOUR_WINDOWS = [
  "12–4am",
  "4–8am",
  "8am–noon",
  "Noon–4pm",
  "4–8pm",
  "8pm–midnight",
];

export function calendarWeekday(day: string) {
  return (new Date(day + "T00:00:00Z").getUTCDay() + 6) % 7;
}

export function metricValue(value: LabTotals, metric: LabMetric) {
  return metric === "time" ? value.ms / 60_000 : value.plays;
}

export function listeningProfile(archive: Archive, period: ArchivePeriod) {
  const days = new Map<string, LabTotals>();
  const hours = Array.from({ length: 24 }, () => ({ plays: 0, ms: 0 }));
  const heat = Array.from({ length: 42 }, () => ({ plays: 0, ms: 0 }));
  const entries = period.rows.map((row) => {
    const day = archive.dates.get(row)!;
    const hour = getHourInTimeZone(row.playedAt, archive.tz);
    const cell = calendarWeekday(day) * 6 + Math.floor(hour / 4);
    const totals = days.get(day) ?? { plays: 0, ms: 0 };
    const ms = Number.isFinite(row.durationMs)
      ? Math.max(0, row.durationMs)
      : 0;
    for (const bucket of [totals, hours[hour], heat[cell]]) {
      bucket.plays++;
      bucket.ms += ms;
    }
    days.set(day, totals);
    return { row, day, hour, cell };
  });
  let longestStreak = 0;
  let currentStreak = 0;
  let previousDay = -Infinity;
  for (const day of [...days.keys()].sort()) {
    const stamp = Date.parse(day);
    currentStreak = stamp - previousDay === 86_400_000 ? currentStreak + 1 : 1;
    longestStreak = Math.max(longestStreak, currentStreak);
    previousDay = stamp;
  }
  return { days, hours, heat, entries, longestStreak };
}
