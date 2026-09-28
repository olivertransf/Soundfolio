"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BarSeriesChart } from "@/components/bar-series-chart";
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

type HistoryMode = "days" | "weeks" | "months";
type ChartMetric = "minutes" | "streams";

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
      <div className="grid gap-2 sm:grid-cols-3">
        <SummaryCell label="Albums" value={summary.uniqueAlbums.toLocaleString()} />
        <SummaryCell
          label="Most active day"
          value={summary.mostActiveDay ?? "—"}
          hint={summary.mostActiveDay ? `${summary.mostActiveMinutes.toLocaleString()} min` : undefined}
        />
        <SummaryCell label="Top 10 tracks" value={`${summary.topTenShare}%`} hint="of minutes" />
      </div>

      <section className="space-y-2 border border-border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Listening over time
          </h2>
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
        </div>
        <BarSeriesChart points={history} metric={metric} label={`Listening by ${mode}`} />
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="space-y-2 border border-border bg-card p-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Time of day
          </h2>
          <BarSeriesChart points={hours} metric={metric} label="Listening by hour" />
        </section>
        <section className="space-y-2 border border-border bg-card p-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Day of week
          </h2>
          <BarSeriesChart points={weekdays} metric={metric} label="Listening by weekday" />
        </section>
      </div>
    </div>
  );
}

function SummaryCell({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border border-border bg-card px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-lg font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
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
