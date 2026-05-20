"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { useIsNarrowChart } from "@/hooks/use-media-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatChartAxisLabel,
  formatChartTooltipLabel,
  type ChartDateLabelKind,
} from "@/lib/stats-timezone";
import { ChartStreamsToggle } from "@/components/chart-streams-toggle";

export type ChartXAxis = "month" | "week" | "day" | "week" | "hour" | "weekday";
export type ChartMetric = "minutes" | "streams" | "both";

interface ChartData {
  label: string;
  minutes: number;
  streams: number;
}

interface ListeningChartProps {
  data: ChartData[];
  xAxis: ChartXAxis;
  /** Calendar buckets from the server are in this IANA zone (defaults to browser). */
  timeZone?: string;
  metric?: ChartMetric;
  height?: number;
  compact?: boolean;
  streamsDisplay?: "line" | "bar";
  /** Default on for `both` / streams-line; off for `minutes` unless set. */
  defaultStreamsLineVisible?: boolean;
}

function resolveChartTimeZone(explicit?: string): string {
  if (explicit) return explicit;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function ListeningChart({
  data,
  xAxis,
  timeZone: timeZoneProp,
  metric = "minutes",
  height = 300,
  compact = false,
  streamsDisplay = "line",
  defaultStreamsLineVisible,
}: ListeningChartProps) {
  const timeZone = resolveChartTimeZone(timeZoneProp);
  const labelKind = xAxis as ChartDateLabelKind;
  const narrow = useIsNarrowChart();
  const baseId = useId().replace(/:/g, "");
  const gradMinutes = `${baseId}-min`;
  const gradStreams = `${baseId}-str`;

  const [streamsLineOn, setStreamsLineOn] = useState(
    () => defaultStreamsLineVisible ?? metric !== "minutes"
  );

  const maxStreams = useMemo(
    () => Math.max(...data.map((d) => d.streams), 1),
    [data]
  );
  const maxMinutes = useMemo(
    () => Math.max(...data.map((d) => d.minutes), 1),
    [data]
  );

  const showStreamsToggle =
    metric === "both" ||
    metric === "minutes" ||
    (metric === "streams" && streamsDisplay === "line");

  const dualMode =
    streamsLineOn && (metric === "both" || metric === "minutes");

  const minutesBarsOnly =
    !streamsLineOn && (metric === "both" || metric === "minutes");

  const commonAxis = {
    tick: { fill: "var(--muted-foreground)", fontSize: 11 },
    axisLine: false,
    tickLine: false,
  };

  const gridStroke = "var(--border)";

  const tooltipStyles = {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
  };

  const barActiveStyle = {
    fill: "#ffffff",
    stroke: "hsl(0 0% 100% / 0.35)",
    strokeWidth: 1,
  };

  const dualMargin = narrow
    ? { top: 6, right: 4, left: 4, bottom: compact ? 24 : 20 }
    : { top: 12, right: 16, left: 8, bottom: compact ? 20 : 8 };
  const singleMargin = narrow
    ? { top: 6, right: 4, left: 4, bottom: compact ? 22 : 16 }
    : { top: 12, right: 12, left: 8, bottom: compact ? 18 : 8 };

  const toggleRow = showStreamsToggle ? (
    <div className="mb-2 flex justify-end">
      <ChartStreamsToggle checked={streamsLineOn} onCheckedChange={setStreamsLineOn} />
    </div>
  ) : null;

  const chartWrap = (chart: ReactNode) => (
    <div className="w-full min-w-0 max-w-full overflow-visible">
      {toggleRow}
      {chart}
    </div>
  );

  if (dualMode) {
    return chartWrap(
      <div className="overflow-visible rounded-2xl [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground">
        <ResponsiveContainer width="100%" height={height} minWidth={0}>
          <ComposedChart data={data} margin={dualMargin}>
            <defs>
              <linearGradient id={gradMinutes} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.95} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.15} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 6" stroke={gridStroke} strokeOpacity={0.45} vertical={false} />
            <XAxis
              dataKey="label"
              {...commonAxis}
              tickFormatter={(v) => formatChartAxisLabel(String(v), labelKind, timeZone)}
              interval={data.length > 24 ? "preserveStartEnd" : 0}
              minTickGap={8}
            />
            <YAxis
              yAxisId="min"
              {...commonAxis}
              tick={{ ...commonAxis.tick, fontSize: narrow ? 10 : 11 }}
              tickFormatter={(v) => `${v}m`}
              width={narrow ? 34 : 44}
              domain={[0, Math.ceil(maxMinutes * 1.08)]}
            />
            <YAxis
              yAxisId="str"
              orientation="right"
              {...commonAxis}
              tick={{ ...commonAxis.tick, fontSize: narrow ? 10 : 11 }}
              tickFormatter={(v) => `${v}`}
              width={narrow ? 30 : 40}
              domain={[0, Math.ceil(maxStreams * 1.08)]}
            />
            <Tooltip
              cursor={false}
              contentStyle={tooltipStyles}
              labelStyle={{ color: "var(--foreground)", fontWeight: 600, marginBottom: 6 }}
              labelFormatter={(v) => formatChartTooltipLabel(String(v), labelKind, timeZone)}
              formatter={(value, name) => {
                if (name === "minutes") return [`${Number(value).toLocaleString()} min`, "Minutes"];
                if (name === "streams") return [`${Number(value).toLocaleString()}`, "Streams"];
                return [value, name];
              }}
            />
            <Bar
              yAxisId="min"
              dataKey="minutes"
              fill={`url(#${gradMinutes})`}
              radius={[4, 4, 0, 0]}
              maxBarSize={xAxis === "day" ? 14 : 36}
              activeBar={barActiveStyle}
            />
            <Line
              yAxisId="str"
              type="linear"
              dataKey="streams"
              stroke="var(--chart-2)"
              strokeWidth={narrow ? 1.75 : 2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              isAnimationActive={false}
              activeDot={{
                r: 5,
                stroke: "var(--background)",
                strokeWidth: 2,
                fill: "var(--chart-2)",
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (minutesBarsOnly) {
    return chartWrap(
      <div className="overflow-visible rounded-2xl [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground">
        <ResponsiveContainer width="100%" height={height} minWidth={0}>
          <BarChart data={data} margin={singleMargin}>
            <defs>
              <linearGradient id={gradMinutes} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.95} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.12} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 6" stroke={gridStroke} strokeOpacity={0.45} vertical={false} />
            <XAxis
              dataKey="label"
              {...commonAxis}
              tickFormatter={(v) => formatChartAxisLabel(String(v), labelKind, timeZone)}
              interval={data.length > 24 ? "preserveStartEnd" : 0}
              minTickGap={8}
            />
            <YAxis
              {...commonAxis}
              tickFormatter={(v) => `${v}m`}
              width={44}
              domain={[0, Math.ceil(maxMinutes * 1.08)]}
            />
            <Tooltip
              cursor={false}
              contentStyle={tooltipStyles}
              labelStyle={{ color: "var(--foreground)", fontWeight: 600, marginBottom: 6 }}
              labelFormatter={(v) => formatChartTooltipLabel(String(v), labelKind, timeZone)}
              formatter={(value) => [`${Number(value).toLocaleString()} min`, "Minutes"]}
            />
            <Bar
              dataKey="minutes"
              fill={`url(#${gradMinutes})`}
              radius={[4, 4, 0, 0]}
              maxBarSize={xAxis === "hour" ? 14 : xAxis === "day" ? 12 : 40}
              activeBar={barActiveStyle}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (metric === "streams" && streamsDisplay === "line") {
    if (!streamsLineOn) {
      return chartWrap(
        <div
          className="flex items-center justify-center rounded-2xl border border-dashed border-border/60 bg-secondary/15 text-center text-sm text-muted-foreground"
          style={{ height }}
        >
          Turn on &ldquo;Streams line&rdquo; to show this chart.
        </div>
      );
    }
    return chartWrap(
      <div className="overflow-visible rounded-2xl [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground">
        <ResponsiveContainer width="100%" height={height} minWidth={0}>
          <LineChart data={data} margin={singleMargin}>
            <CartesianGrid strokeDasharray="3 6" stroke={gridStroke} strokeOpacity={0.45} vertical={false} />
            <XAxis
              dataKey="label"
              {...commonAxis}
              tickFormatter={(v) => formatChartAxisLabel(String(v), labelKind, timeZone)}
              interval={data.length > 24 ? "preserveStartEnd" : 0}
              minTickGap={8}
            />
            <YAxis
              {...commonAxis}
              tick={{ ...commonAxis.tick, fontSize: narrow ? 10 : 11 }}
              tickFormatter={(v) => `${v}`}
              width={narrow ? 36 : 44}
              domain={[0, Math.ceil(maxStreams * 1.08)]}
            />
            <Tooltip
              cursor={false}
              contentStyle={tooltipStyles}
              labelStyle={{ color: "var(--foreground)", fontWeight: 600, marginBottom: 6 }}
              labelFormatter={(v) => formatChartTooltipLabel(String(v), labelKind, timeZone)}
              formatter={(value) => [Number(value).toLocaleString(), "Streams"]}
            />
            <Line
              type="monotone"
              dataKey="streams"
              stroke="var(--chart-2)"
              strokeWidth={narrow ? 2.5 : 3}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={{ r: narrow ? 3 : 4, fill: "var(--chart-2)", stroke: "var(--background)", strokeWidth: 2 }}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const dataKey = metric === "streams" ? "streams" : "minutes";
  const fillId = metric === "streams" ? gradStreams : gradMinutes;

  return chartWrap(
    <div className="overflow-hidden rounded-2xl [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground">
      <ResponsiveContainer width="100%" height={height} minWidth={0}>
        <BarChart data={data} margin={singleMargin}>
          <defs>
            <linearGradient id={gradMinutes} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.95} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.12} />
            </linearGradient>
            <linearGradient id={gradStreams} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.9} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.12} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 6" stroke={gridStroke} strokeOpacity={0.45} vertical={false} />
          <XAxis
            dataKey="label"
            {...commonAxis}
            tickFormatter={(v) => formatChartAxisLabel(String(v), labelKind, timeZone)}
            interval={data.length > 24 ? "preserveStartEnd" : 0}
            minTickGap={8}
          />
          <YAxis
            {...commonAxis}
            tickFormatter={(v) => (metric === "streams" ? `${v}` : `${v}m`)}
            width={metric === "streams" ? 36 : 44}
            domain={[
              0,
              metric === "streams"
                ? Math.ceil(maxStreams * 1.08)
                : Math.ceil(maxMinutes * 1.08),
            ]}
          />
          <Tooltip
            cursor={false}
            contentStyle={tooltipStyles}
            labelStyle={{ color: "var(--foreground)", fontWeight: 600, marginBottom: 6 }}
            labelFormatter={(v) => formatChartTooltipLabel(String(v), labelKind, timeZone)}
            formatter={(value) => {
              const n = Number(value);
              if (metric === "streams") return [n.toLocaleString(), "Streams"];
              return [`${n.toLocaleString()} min`, "Minutes"];
            }}
          />
          <Bar
            dataKey={dataKey}
            fill={`url(#${fillId})`}
            radius={[4, 4, 0, 0]}
            maxBarSize={xAxis === "hour" ? 14 : xAxis === "day" ? 12 : 40}
            activeBar={barActiveStyle}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
