"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ChartXAxis } from "@/components/listening-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GroupBySelect, type GroupByMode } from "@/components/group-by-select";
import { TimeRangeTabs } from "@/components/time-range-tabs";
import { cn } from "@/lib/utils";
import { VIEWER_TIMEZONE_PARAM } from "@/lib/stats-timezone";
import {
  getStoredGroupBy,
  setStoredGroupBy,
} from "@/lib/stats-session-preferences";

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
  historyApiPath = "/api/stats/history",
  compact = false,
}: {
  periodLabel: string;
  historyApiPath?: string;
  /** Denser layout and shorter chart for overview / dashboards. */
  compact?: boolean;
}) {
  const searchParams = useSearchParams();
  const [granularity, setGranularity] = useState<GroupByMode>("weeks");
  const [data, setData] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeZone, setTimeZone] = useState<string>("");

  const range = searchParams.get("range") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  useEffect(() => {
    try {
      setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "");
    } catch {
      setTimeZone("");
    }
  }, []);

  useEffect(() => {
    setGranularity(getStoredGroupBy());
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      mode: granularityConfig[granularity].apiMode,
    });
    if (range) params.set("range", range);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (timeZone) params.set(VIEWER_TIMEZONE_PARAM, timeZone);
    fetch(`${historyApiPath}?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d.data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [granularity, range, from, to, timeZone, historyApiPath]);

  const cfg = granularityConfig[granularity];

  const chartH = compact ? 200 : 300;
  const loadH = compact ? 180 : 280;

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
    <div className={cn(compact ? "space-y-3" : "space-y-6")}>
      {compact ? (
        <div className="rounded-2xl border border-border/40 bg-card/30 px-4 py-3">
          {filterRow}
        </div>
      ) : (
        filterRow
      )}

      <Card
        className={cn(
          "overflow-hidden shadow-none",
          compact
            ? "rounded-2xl border border-border/40 bg-card/40 ring-0"
            : "border-border/50 bg-card/60 ring-1 ring-border/40"
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
              {periodLabel}. Use the streams line toggle to compare play counts.
            </p>
          )}
        </CardHeader>
        <CardContent className={cn("pt-0", compact ? "px-4 pb-4" : undefined)}>
          {loading ? (
            <div
              className="flex items-center justify-center rounded-xl bg-secondary/20 text-sm text-muted-foreground"
              style={{ minHeight: loadH }}
            >
              Loading chart…
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
              metric="minutes"
              height={chartH}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
