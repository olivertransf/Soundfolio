"use client";

import { BarSeriesChart, type ChartPoint } from "@/components/bar-series-chart";

export function EntityCharts({
  history,
  hours,
  weekdays,
}: {
  history: ChartPoint[];
  hours: ChartPoint[];
  weekdays: ChartPoint[];
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-3">
        <BarSeriesChart points={[...history].reverse()} metric="minutes" label="Listening over time" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-3">
          <BarSeriesChart points={hours} metric="minutes" label="Time of day" />
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <BarSeriesChart points={weekdays} metric="minutes" label="Weekday" />
        </div>
      </div>
    </div>
  );
}
