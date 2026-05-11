"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChartXAxis } from "@/components/listening-chart";
import { TimeRangeTabs } from "@/components/time-range-tabs";
import { GroupBySelect } from "@/components/group-by-select";
import { PageHeader } from "@/components/page-header";
import { describeTimeRangeFromSearchParams } from "@/lib/time-range-labels";
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
      <div className="flex h-72 items-center justify-center rounded-xl bg-secondary/20 text-sm text-muted-foreground">
        Loading chart…
      </div>
    ),
  }
);

type Mode = "weeks" | "months" | "days";

interface ChartPoint {
  label: string;
  minutes: number;
  streams: number;
}

function modeToXAxis(mode: Mode): ChartXAxis {
  if (mode === "weeks") return "week";
  if (mode === "days") return "day";
  return "month";
}

function HistoryContent() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("weeks");
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeZone, setTimeZone] = useState<string>("");

  const range = searchParams.get("range") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const periodLabel = describeTimeRangeFromSearchParams(searchParams);

  useEffect(() => {
    try {
      setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "");
    } catch {
      setTimeZone("");
    }
  }, []);

  useEffect(() => {
    setMode(getStoredGroupBy());
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ mode });
    if (range) params.set("range", range);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (timeZone) params.set(VIEWER_TIMEZONE_PARAM, timeZone);
    fetch(`/api/stats/history?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d.data ?? []);
        setLoading(false);
      });
  }, [mode, range, from, to, timeZone]);

  const chartTitle =
    mode === "months"
      ? "Monthly"
      : mode === "weeks"
        ? "Weekly"
        : "Daily";

  const filterControls = (
    <div className="grid w-full gap-3 sm:grid-cols-2 sm:gap-4">
      <div className="min-w-0 space-y-1.5 overflow-visible">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Period
        </p>
        <TimeRangeTabs />
      </div>
      <div className="min-w-0 space-y-1.5 overflow-visible">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Group by
        </p>
        <GroupBySelect
          value={mode}
          onValueChange={(v) => {
            setMode(v);
            setStoredGroupBy(v);
          }}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-10">
      <PageHeader
        title="Listening history"
        description="Zoom from every day up through months. Same ranges as the rest of the app."
        periodLabel={periodLabel}
      >
        {filterControls}
      </PageHeader>

      <Card className="overflow-hidden border-border/50 bg-card/60 ring-1 ring-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Minutes listened · {chartTitle}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Total minutes per period (bars). Use the streams line toggle to compare play counts.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-72 items-center justify-center rounded-xl bg-secondary/20 text-sm text-muted-foreground">
              Loading…
            </div>
          ) : data.length === 0 ? (
            <div className="flex h-72 items-center justify-center rounded-xl bg-secondary/20 text-sm text-muted-foreground">
              No data for this range.
            </div>
          ) : (
            <ListeningChart
              data={data}
              xAxis={modeToXAxis(mode)}
              metric="minutes"
              height={280}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <HistoryContent />
    </Suspense>
  );
}
