"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

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
    <section className="flex h-full min-w-0 flex-col gap-2 border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{caption}</p>
        </div>
        {actions}
      </div>
      <div className="mt-auto">{children}</div>
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

function barPath(x: number, y: number, width: number, height: number) {
  const radius = Math.min(8, width / 2, height / 2);
  if (radius <= 0.5) {
    return `M ${x} ${y} h ${width} v ${height} h ${-width} Z`;
  }
  return `M ${x} ${y + height} V ${y + radius} Q ${x} ${y} ${x + radius} ${y} H ${x + width - radius} Q ${x + width} ${y} ${x + width} ${y + radius} V ${y + height} Z`;
}

function labelWidth(label: string) {
  return chartAxisLabel(label).length * 6.6 + 8;
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
  const frameRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const measure = () => {
      const next = Math.floor(node.clientWidth);
      setWidth((current) => (current === next ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const scrollStart = `${points[0]?.label ?? ""}:${points.length}`;
  useLayoutEffect(() => {
    frameRef.current?.scrollTo({ left: 0 });
  }, [scrollStart]);

  const unit = metric === "minutes" ? "min" : "plays";
  const values = points.map((point) => (metric === "minutes" ? point.minutes : point.streams));
  const max = Math.max(1, ...values);
  const height = 176;
  const showScale = points.length > 8;
  const padTop = 22;
  const padBottom = 28;
  const plotHeight = height - padTop - padBottom;
  const maxLabel = Math.max(20, ...points.map((point) => labelWidth(point.label)));
  const slot = maxLabel;
  const edge = maxLabel / 2;
  const minContent = edge * 2 + points.length * slot;
  const contentWidth = Math.max(width, minContent);
  const usedSlot = points.length > 0 ? (contentWidth - edge * 2) / points.length : slot;
  const barWidth = Math.max(2, usedSlot - 3);
  const baseline = padTop + plotHeight;

  return (
    <div className="flex h-44 w-full min-w-0">
      <div className="relative w-11 shrink-0 text-[11px] text-muted-foreground">
        {showScale ? (
          <span className="absolute left-0 top-0 leading-none">
            {compactNumber(max)}
            <span className="block text-[10px]">{unit}</span>
          </span>
        ) : null}
        <span className="absolute left-0 leading-none" style={{ top: baseline - 8 }}>
          0
        </span>
      </div>
      <div ref={frameRef} className="h-44 min-w-0 flex-1 overflow-x-auto">
        {points.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-muted-foreground">No plays in this range.</p>
        ) : width < 1 ? null : (
          <svg
            viewBox={`0 0 ${contentWidth} ${height}`}
            width={contentWidth}
            height={height}
            className="block"
            role="img"
            aria-label={label}
          >
            <line x1={0} x2={contentWidth} y1={baseline} y2={baseline} className="stroke-border" />
            {values.map((value, index) => {
              const barHeight = Math.max(value > 0 ? 2 : 0, (value / max) * plotHeight);
              const x = edge + index * usedSlot + (usedSlot - barWidth) / 2;
              const y = baseline - barHeight;
              const point = points[index];
              return (
                <g key={`${point?.label ?? index}`}>
                  <path d={barPath(x, y, barWidth, barHeight)} className="fill-primary">
                    <title>
                      {chartAxisLabel(point?.label ?? "")}: {value.toLocaleString()} {unit}
                    </title>
                  </path>
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
                  <text
                    x={edge + index * usedSlot + usedSlot / 2}
                    y={height - 6}
                    textAnchor="middle"
                    fontSize={11}
                    className="fill-muted-foreground"
                  >
                    {chartAxisLabel(points[index]?.label ?? "")}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
