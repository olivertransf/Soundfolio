"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BarSeriesChart,
  ChartPanel,
  chartAxisLabel,
  chartCaption,
  historyChartTitle,
  type ChartMetric,
  type HistoryMode,
} from "@/components/bar-series-chart";
import { StatRow } from "@/components/entity/entity-hero";
import { FilterToolbar } from "@/components/filter-toolbar";
import { useStreams } from "@/components/streams-provider";
import {
  calendarDaysInFilter,
  computeInsightSummary,
  computeListeningSpan,
  computeStreamsByDayOfWeek,
  computeStreamsByHour,
  parseTimeRange,
} from "@/lib/stats-compute";
import { historyChartData } from "@/lib/stats-chart-data";
import { VIEWER_TIMEZONE_PARAM } from "@/lib/stats-timezone";
import {
  detectViewerTimeZone,
  readViewerTimeZoneCookie,
} from "@/lib/viewer-timezone-client";

function defaultMode(days: number): HistoryMode {
  if (days > 400) return "months";
  if (days > 120) return "weeks";
  return "days";
}

function InsightsSectionInner() {
  const searchParams = useSearchParams();
  const { streams, loading } = useStreams();
  const range = searchParams.get("range") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const viewerTimeZone =
    searchParams.get(VIEWER_TIMEZONE_PARAM) ??
    readViewerTimeZoneCookie() ??
    detectViewerTimeZone();
  const filter = useMemo(
    () => parseTimeRange(range, from, to, viewerTimeZone ?? undefined),
    [range, from, to, viewerTimeZone]
  );
  const span = useMemo(() => computeListeningSpan(streams, filter), [streams, filter]);
  const days = calendarDaysInFilter(filter, span, viewerTimeZone ?? undefined);
  const [mode, setMode] = useState<HistoryMode>(() => defaultMode(days));
  const [metric, setMetric] = useState<ChartMetric>("minutes");

  const history = useMemo(
    () => historyChartData(streams, mode, filter, viewerTimeZone ?? "UTC"),
    [streams, mode, filter, viewerTimeZone]
  );
  const hours = useMemo(
    () => computeStreamsByHour(streams, filter, viewerTimeZone ?? undefined),
    [streams, filter, viewerTimeZone]
  );
  const weekdays = useMemo(
    () => computeStreamsByDayOfWeek(streams, filter, viewerTimeZone ?? undefined),
    [streams, filter, viewerTimeZone]
  );
  const summary = useMemo(
    () => computeInsightSummary(streams, filter, viewerTimeZone ?? undefined),
    [streams, filter, viewerTimeZone]
  );

  if (loading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-3">
      <FilterToolbar context="insights" />
      <StatRow
        items={[
          { label: "Albums", value: summary.uniqueAlbums.toLocaleString() },
          {
            label: "Most active day",
            value: summary.mostActiveDay ? chartAxisLabel(summary.mostActiveDay) : "—",
            hint: summary.mostActiveDay ? `${summary.mostActiveMinutes.toLocaleString()} min` : undefined,
          },
          { label: "Top 10 tracks", value: `${summary.topTenShare}%`, hint: "of minutes" },
        ]}
      />

      <ChartPanel
        title={historyChartTitle(mode, metric)}
        caption={chartCaption(filter.label, metric)}
        actions={
          <div className="flex flex-wrap gap-2">
            <Segment
              value={mode}
              options={[
                ["days", "Days"],
                ["weeks", "Weeks"],
                ["months", "Months"],
              ]}
              onChange={setMode}
            />
            <Segment
              value={metric}
              options={[
                ["minutes", "Minutes"],
                ["streams", "Plays"],
              ]}
              onChange={setMetric}
            />
          </div>
        }
      >
        <BarSeriesChart points={history} metric={metric} label={historyChartTitle(mode, metric)} />
      </ChartPanel>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartPanel
          title={metric === "minutes" ? "Minutes by hour" : "Plays by hour"}
          caption={chartCaption(filter.label, metric)}
        >
          <BarSeriesChart points={hours} metric={metric} label="Listening by hour" />
        </ChartPanel>
        <ChartPanel
          title={metric === "minutes" ? "Minutes by weekday" : "Plays by weekday"}
          caption={chartCaption(filter.label, metric)}
        >
          <BarSeriesChart points={weekdays} metric={metric} label="Listening by weekday" />
        </ChartPanel>
      </div>

      <ChartPanel title="Top 10 share" caption="Share of minutes in this period">
        <BarSeriesChart
          points={[
            { label: "Top 10", minutes: summary.topTenMinutes, streams: 0 },
            { label: "Rest", minutes: summary.restMinutes, streams: 0 },
          ]}
          metric="minutes"
          label="Top 10 share of minutes"
        />
      </ChartPanel>
    </div>
  );
}

function Segment<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<[T, string]>;
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex border border-border">
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={
            value === id
              ? "min-h-11 bg-primary/15 px-3 text-xs font-medium text-primary"
              : "min-h-11 px-3 text-xs text-muted-foreground"
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function LibraryInsightsSection() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading insights…</p>}>
      <InsightsSectionInner />
    </Suspense>
  );
}
