import type { ReactNode } from "react";

export type ChartPoint = {
  label: string;
  minutes: number;
  streams: number;
};

export type ChartMetric = "minutes" | "streams";
export type HistoryMode = "days" | "weeks" | "months";

export function historyChartTitle(mode: HistoryMode, metric: ChartMetric) {
  const measure = metric === "minutes" ? "Minutes" : "Plays";
  const grain = mode === "days" ? "day" : mode === "weeks" ? "week" : "month";
  return `${measure} by ${grain}`;
}

export function chartCaption(rangeLabel: string, metric: ChartMetric) {
  return `${rangeLabel} · ${metric === "minutes" ? "Minutes" : "Plays"}`;
}

export function ChartPanel({
  title,
  caption,
  actions,
  children,
}: {
  title: string;
  caption: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2 border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{caption}</p>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function chartAxisLabel(label: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
    const [year, month, day] = label.split("-").map(Number);
    return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1)).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  }
  if (/^\d{4}-\d{2}$/.test(label)) {
    const [year, month] = label.split("-").map(Number);
    return new Date(Date.UTC(year, (month ?? 1) - 1, 1)).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });
  }
  if (/^\d{2}:00$/.test(label)) {
    const hour = Number(label.slice(0, 2));
    const hour12 = hour % 12 || 12;
    return `${hour12}${hour < 12 ? "a" : "p"}`;
  }
  return label.length > 16 ? `${label.slice(0, 15)}…` : label;
}

function compactNumber(value: number) {
  if (value >= 10000) return `${Math.round(value / 1000)}k`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toLocaleString();
}

function tickIndexes(count: number) {
  if (count <= 8) return Array.from({ length: count }, (_, index) => index);
  const step = Math.ceil(count / 6);
  const indexes: number[] = [];
  for (let index = 0; index < count; index += step) indexes.push(index);
  if (indexes[indexes.length - 1] !== count - 1) indexes.push(count - 1);
  return indexes;
}

export function BarSeriesChart({
  points,
  metric,
  label,
}: {
  points: ChartPoint[];
  metric: "minutes" | "streams";
  label: string;
}) {
  const unit = metric === "minutes" ? "min" : "plays";
  const values = points.map((point) => (metric === "minutes" ? point.minutes : point.streams));
  const max = Math.max(1, ...values);
  const width = 640;
  const height = 176;
  const showScale = points.length > 8;
  const padLeft = 18;
  const padRight = 8;
  const padTop = showScale ? 22 : 16;
  const padBottom = 22;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  const gap = points.length > 40 ? 1 : 3;
  const barWidth = Math.max(1, (plotWidth - gap * Math.max(points.length - 1, 0)) / Math.max(points.length, 1));

  if (points.length === 0) {
    return <p className="px-2 py-8 text-center text-sm text-muted-foreground">No plays in this range.</p>;
  }

  const centers = values.map((_, index) => padLeft + index * (barWidth + gap) + barWidth / 2);
  const candidates = tickIndexes(points.length);
  const visible: number[] = [];
  let lastRight = -Infinity;
  for (const index of candidates) {
    const text = chartAxisLabel(points[index]?.label ?? "");
    const half = (text.length * 6.4) / 2;
    const x = centers[index] ?? 0;
    if (x - half < lastRight + 6) continue;
    visible.push(index);
    lastRight = x + half;
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-44 w-full font-mono"
      role="img"
      aria-label={label}
    >
      {showScale ? (
        <text x={padLeft} y={12} fontSize={11} className="fill-muted-foreground">
          {compactNumber(max)} {unit}
        </text>
      ) : null}
      <text
        x={padLeft - 6}
        y={padTop + plotHeight}
        textAnchor="end"
        fontSize={11}
        className="fill-muted-foreground"
      >
        0
      </text>
      <line
        x1={padLeft}
        x2={width - padRight}
        y1={padTop + plotHeight}
        y2={padTop + plotHeight}
        className="stroke-border"
      />
      {values.map((value, index) => {
        const barHeight = Math.max(value > 0 ? 2 : 0, (value / max) * plotHeight);
        const x = padLeft + index * (barWidth + gap);
        const y = padTop + plotHeight - barHeight;
        const point = points[index];
        return (
          <g key={`${point?.label ?? index}`}>
            <rect x={x} y={y} width={barWidth} height={barHeight} className="fill-primary">
              <title>
                {chartAxisLabel(point?.label ?? "")}: {value.toLocaleString()} {unit}
              </title>
            </rect>
            {points.length <= 8 && value > 0 ? (
              <text
                x={x + barWidth / 2}
                y={Math.max(12, y - 4)}
                textAnchor="middle"
                fontSize={11}
                className="fill-foreground"
              >
                {compactNumber(value)}
              </text>
            ) : null}
          </g>
        );
      })}
      {visible.map((index) => (
        <text
          key={`tick-${points[index]?.label ?? index}`}
          x={centers[index]}
          y={height - 4}
          textAnchor="middle"
          fontSize={11}
          className="fill-muted-foreground"
        >
          {chartAxisLabel(points[index]?.label ?? "")}
        </text>
      ))}
    </svg>
  );
}
