"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { VIEWER_TIMEZONE_PARAM } from "@/lib/stats-timezone";
import {
  detectViewerTimeZone,
  readViewerTimeZoneCookie,
} from "@/lib/viewer-timezone-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListeningChart } from "@/components/listening-chart";
import { ListeningHeatmap } from "@/components/listening-heatmap";

const CHART_H = 200;

const panelTitle = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const cardShell =
  "overflow-hidden rounded-2xl border border-border/40 bg-card/40 shadow-none ring-0";
const cardHeaderPad = "border-b border-border/30 px-4 py-3";
const cardContentPad = "px-4 pb-4 pt-3";

type PatternsPayload = {
  timeZone: string;
  byHour: { label: string; minutes: number; streams: number }[];
  byDay: { label: string; minutes: number; streams: number }[];
  heatmap: {
    grid: { day: number; hour: number; count: number }[];
    dayNames: string[];
  };
};

export function HomePatternsSection({ periodLabel }: { periodLabel: string }) {
  const searchParams = useSearchParams();
  const [timeZone, setTimeZone] = useState("");
  const [data, setData] = useState<PatternsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = searchParams.get("range") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  useEffect(() => {
    setTimeZone(
      searchParams.get(VIEWER_TIMEZONE_PARAM) ??
        readViewerTimeZoneCookie() ??
        detectViewerTimeZone() ??
        ""
    );
  }, [searchParams]);

  useEffect(() => {
    if (!timeZone) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (range) params.set("range", range);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set(VIEWER_TIMEZONE_PARAM, timeZone);

    fetch(`/api/stats/patterns?${params}`)
      .then((r) => r.json())
      .then((payload: PatternsPayload) => {
        setData(payload);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load listening patterns.");
        setLoading(false);
      });
  }, [timeZone, range, from, to]);

  const { peakHour, peakDay, hourChartData, dayChartData } = useMemo(() => {
    if (!data) {
      return {
        peakHour: null,
        peakDay: null,
        hourChartData: [] as PatternsPayload["byHour"],
        dayChartData: [] as PatternsPayload["byDay"],
      };
    }
    const peakHour =
      data.byHour.length > 0
        ? data.byHour.reduce((a, b) => (a.minutes >= b.minutes ? a : b))
        : null;
    const peakDay =
      data.byDay.length > 0
        ? data.byDay.reduce((a, b) => (a.minutes >= b.minutes ? a : b))
        : null;
    return {
      peakHour,
      peakDay,
      hourChartData: data.byHour,
      dayChartData: data.byDay,
    };
  }, [data]);

  return (
    <section
      id="patterns"
      className="scroll-mt-28 space-y-4"
      aria-labelledby="home-patterns-heading"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <h2
          id="home-patterns-heading"
          className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
        >
          Listening patterns
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          {periodLabel}. Hours use your local timezone
          {timeZone ? ` (${timeZone.replace(/_/g, " ")})` : ""}.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border/40 bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground">
          Loading patterns…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-10 text-center text-sm text-destructive">
          {error}
        </div>
      ) : !data ? null : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div className={`rounded-2xl border border-border/40 bg-card/40 ${cardContentPad}`}>
              <p className={panelTitle}>Busiest hour</p>
              <p className="mt-2 font-display text-xl font-semibold tabular-nums tracking-tight text-foreground">
                {peakHour ? peakHour.label : "—"}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {peakHour
                  ? `${peakHour.minutes.toLocaleString()} minutes · ${peakHour.streams.toLocaleString()} streams`
                  : "No plays in this range."}
              </p>
            </div>
            <div className={`rounded-2xl border border-border/40 bg-card/40 ${cardContentPad}`}>
              <p className={panelTitle}>Busiest day</p>
              <p className="mt-2 font-display text-xl font-semibold tracking-tight text-foreground">
                {peakDay ? peakDay.label : "—"}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {peakDay
                  ? `${peakDay.minutes.toLocaleString()} minutes · ${peakDay.streams.toLocaleString()} streams`
                  : "No plays in this range."}
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className={cardShell}>
              <CardHeader className={`space-y-0 ${cardHeaderPad}`}>
                <CardTitle className={panelTitle}>By hour of day</CardTitle>
              </CardHeader>
              <CardContent className={cardContentPad}>
                <ListeningChart
                  data={hourChartData}
                  xAxis="hour"
                  timeZone={timeZone}
                  metric="both"
                  height={CHART_H}
                />
              </CardContent>
            </Card>
            <Card className={cardShell}>
              <CardHeader className={`space-y-0 ${cardHeaderPad}`}>
                <CardTitle className={panelTitle}>By weekday</CardTitle>
              </CardHeader>
              <CardContent className={cardContentPad}>
                <ListeningChart
                  data={dayChartData}
                  xAxis="weekday"
                  timeZone={timeZone}
                  metric="both"
                  height={CHART_H}
                />
              </CardContent>
            </Card>
          </div>

          <Card className={cardShell}>
            <CardHeader className={`space-y-0 ${cardHeaderPad}`}>
              <CardTitle className={panelTitle}>Week × hour</CardTitle>
            </CardHeader>
            <CardContent className={`overflow-x-auto ${cardContentPad}`}>
              <ListeningHeatmap grid={data.heatmap.grid} dayNames={data.heatmap.dayNames} />
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
