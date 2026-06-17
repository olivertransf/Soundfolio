"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ChartMetric, ChartXAxis } from "@/components/listening-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GroupBySelect, type GroupByMode } from "@/components/group-by-select";
import { TimeRangeTabs } from "@/components/time-range-tabs";
import { cn } from "@/lib/utils";
import { VIEWER_TIMEZONE_PARAM } from "@/lib/stats-timezone";
import {
  detectViewerTimeZone,
  readViewerTimeZoneCookie,
} from "@/lib/viewer-timezone-client";
import {
  getStoredGroupBy,
  setStoredGroupBy,
} from "@/lib/stats-session-preferences";
import { historyChartData, parseChartFilter } from "@/lib/stats-chart-data";
import { useStreams } from "@/components/streams-provider";

const ListeningChart = dynamic(
  () =>
    import("@/components/listening-chart").then((m) => ({
      default: m.ListeningChart,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[220px] items-center justify-center rounded-xl bg-secondary/20 text-sm text-muted-foreground sm:h-[280px]">
        Loading chart…
      </div>
    ),
  }
);

interface Point {
  label: string;
  minutes: number;
  streams: number;
}

const granularityConfig: Record<
  GroupByMode,
  { apiMode: string; title: string; xAxis: ChartXAxis }
> = {
  months: { apiMode: "months", title: "Monthly", xAxis: "month" },
  weeks: { apiMode: "weeks", title: "Weekly", xAxis: "week" },
  days: { apiMode: "days", title: "Daily", xAxis: "day" },
};

export function ListeningActivity({
  periodLabel,
  compact = false,
  className,
}: {
  periodLabel: string;
  /** Denser layout and shorter chart for overview / dashboards. */
  compact?: boolean;
  className?: string;
}) {
  const { streams, loading: streamsLoading } = useStreams();
  const searchParams = useSearchParams();
  const [granularity, setGranularity] = useState<GroupByMode>("weeks");
  const [data, setData] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeZone, setTimeZone] = useState<string>("");
  const [metric, setMetric] = useState<ChartMetric>("minutes");

  const range = searchParams.get("range") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  useEffect(() => {
    try {
      setTimeZone(readViewerTimeZoneCookie() ?? detectViewerTimeZone() ?? "");
      const raw = window.localStorage.getItem("soundfolio:display-preferences");
      if (raw) {
        const parsed = JSON.parse(raw) as { chartMetric?: ChartMetric };
        if (parsed.chartMetric === "minutes" || parsed.chartMetric === "streams" || parsed.chartMetric === "both") {
          setMetric(parsed.chartMetric);
        }
      }
    } catch {
      setTimeZone("");
    }
  }, []);

  useEffect(() => {
    setGranularity(getStoredGroupBy());
  }, []);

  useEffect(() => {
    if (!timeZone || streamsLoading) return;
    setLoading(true);
    setError(null);
    try {
      const filter = parseChartFilter(range, from, to, timeZone);
      const mode = granularityConfig[granularity].apiMode as "months" | "weeks" | "days";
      setData(historyChartData(streams, mode, filter, timeZone));
    } catch {
      setError("Could not load chart data.");
    } finally {
      setLoading(false);
    }
  }, [granularity, range, from, to, timeZone, streams, streamsLoading]);

  const cfg = granularityConfig[granularity];

  const chartH = compact ? 220 : 300;
  const loadH = compact ? 200 : 280;

  const filterRow = (
    <div
      className={cn(
        "grid w-full sm:grid-cols-2",
        compact ? "gap-2 sm:gap-3" : "gap-3 sm:gap-4"
      )}
    >
      <div className="min-w-0 space-y-1.5 overflow-visible">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Period
        </p>
        <TimeRangeTabs />
      </div>
      <div className="min-w-0 space-y-1.5 overflow-visible">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Group by
        </p>
        <GroupBySelect
          value={granularity}
          onValueChange={(v) => {
            setGranularity(v);
            setStoredGroupBy(v);
          }}
        />
      </div>
    </div>
  );

  return (
    <div className={cn(compact ? "space-y-3" : "space-y-6", className)}>
      {compact ? (
        <div className="rounded-2xl border border-border/40 bg-card/30 px-4 py-3">
          {filterRow}
        </div>
      ) : (
        filterRow
      )}

      <Card
        className={cn(
          "shadow-none",
          compact
            ? "rounded-2xl border border-border/40 bg-card/40 ring-0"
            : "overflow-hidden border-border/50 bg-card/60 ring-1 ring-border/40"
        )}
      >
        <CardHeader
          className={cn("space-y-1", compact ? "border-b border-border/30 px-4 py-3" : "pb-2")}
        >
          <CardTitle
            className={cn(
              "font-semibold tracking-tight",
              compact ? "text-sm text-foreground" : "text-base"
            )}
          >
            Listening · {cfg.title}
          </CardTitle>
          {compact ? (
            <p className="text-xs leading-relaxed text-muted-foreground">{periodLabel}</p>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {periodLabel}. Compare minutes and plays in one view.
            </p>
          )}
        </CardHeader>
        <CardContent className={cn("pt-0", compact ? "px-4 pb-5" : undefined)}>
          {loading || streamsLoading ? (
            <div
              className="flex items-center justify-center rounded-xl bg-secondary/20 text-sm text-muted-foreground"
              style={{ minHeight: loadH }}
            >
              Loading chart…
            </div>
          ) : error ? (
            <div
              className="flex items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10 px-4 text-center text-sm text-destructive"
              style={{ minHeight: loadH }}
            >
              {error}
            </div>
          ) : data.length === 0 ? (
            <div
              className="flex items-center justify-center rounded-xl bg-secondary/20 text-sm text-muted-foreground"
              style={{ minHeight: loadH }}
            >
              No plays in this period.
            </div>
          ) : (
            <ListeningChart
              data={data}
              xAxis={cfg.xAxis}
              timeZone={timeZone || undefined}
              metric={metric}
              height={chartH}
              compact={compact}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
