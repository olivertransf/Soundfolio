"use client";

import { BarSeriesChart, chartAxisLabel, type ChartPoint } from "@/components/bar-series-chart";
import { DonutChart } from "@/components/visual/mix-charts";
import { NumberChart, countDetail } from "@/components/visual/stat-grid";

function peakDetail(points: ChartPoint[]) {
  const peak = points.reduce<ChartPoint | null>(
    (best, point) => (point.minutes > (best?.minutes ?? -1) ? point : best),
    null
  );
  if (!peak || peak.minutes <= 0) return undefined;
  return `${chartAxisLabel(peak.label)} · ${countDetail(peak.minutes, peak.streams)}`;
}

function daypartsFromHours(hours: ChartPoint[]): ChartPoint[] {
  const parts: ChartPoint[] = [
    { label: "Night", minutes: 0, streams: 0 },
    { label: "Morning", minutes: 0, streams: 0 },
    { label: "Afternoon", minutes: 0, streams: 0 },
    { label: "Evening", minutes: 0, streams: 0 },
  ];
  for (const point of hours) {
    const hour = Number(point.label.slice(0, 2));
    const index = hour < 6 ? 0 : hour < 12 ? 1 : hour < 18 ? 2 : 3;
    parts[index].minutes += point.minutes;
    parts[index].streams += point.streams;
  }
  return parts;
}

function weekSplit(weekdays: ChartPoint[]): ChartPoint[] {
  const weekday: ChartPoint = { label: "Weekday", minutes: 0, streams: 0 };
  const weekend: ChartPoint = { label: "Weekend", minutes: 0, streams: 0 };
  for (const point of weekdays) {
    const bucket = point.label === "Sat" || point.label === "Sun" ? weekend : weekday;
    bucket.minutes += point.minutes;
    bucket.streams += point.streams;
  }
  return [weekday, weekend];
}

export function EntityCharts({
  history,
  hours,
  weekdays,
}: {
  history: ChartPoint[];
  hours: ChartPoint[];
  weekdays: ChartPoint[];
}) {
  const ordered = [...history].reverse();
  const dayparts = daypartsFromHours(hours);
  const weekParts = weekSplit(weekdays);
  return (
    <div className="space-y-3">
      <NumberChart title="Over time" detail={peakDetail(ordered)}>
        <BarSeriesChart points={ordered} metric="minutes" label="Listening over time" />
      </NumberChart>
      <div className="grid gap-3 lg:grid-cols-2">
        <NumberChart title="Time of day" detail={peakDetail(hours)}>
          <BarSeriesChart points={hours} metric="minutes" label="Time of day" />
        </NumberChart>
        <NumberChart title="Weekday" detail={peakDetail(weekdays)}>
          <BarSeriesChart points={weekdays} metric="minutes" label="Weekday" />
        </NumberChart>
        <NumberChart title="Parts of the day" detail={peakDetail(dayparts)}>
          <DonutChart points={dayparts} />
        </NumberChart>
        <NumberChart title="Week or weekend" detail={peakDetail(weekParts)}>
          <DonutChart points={weekParts} />
        </NumberChart>
      </div>
    </div>
  );
}
