"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { VIEWER_TIMEZONE_PARAM } from "@/lib/stats-timezone";
import {
  detectViewerTimeZone,
  readViewerTimeZoneCookie,
} from "@/lib/viewer-timezone-client";
import {
  computeStreamsByDayOfWeek,
  computeStreamsByHour,
  parseTimeRange,
} from "@/lib/stats-compute";
import { useStreams } from "@/components/streams-provider";
import { ContentPanel, SectionBlock } from "@/components/page-shell";
import { cn } from "@/lib/utils";
import { librarySectionHref } from "@/components/library/library-content";

type PatternRow = { label: string; minutes: number; streams: number };

function RankedMetricRows({
  rows,
  empty,
  compact = false,
}: {
  rows: PatternRow[];
  empty: string;
  compact?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="px-2 py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  }

  const maxMinutes = Math.max(...rows.map((r) => r.minutes), 1);

  return (
    <ul className="divide-y divide-border">
      {rows.map((row, i) => (
        <li
          key={row.label}
          data-row
          className={cn("flex items-center gap-2 text-sm", compact ? "py-1.5" : "gap-3 py-2")}
        >
          <span className="w-5 shrink-0 tabular-nums text-xs text-muted-foreground">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-xs font-medium sm:text-sm">{row.label}</span>
              <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">
                {row.minutes.toLocaleString()}m
              </span>
            </div>
            <div className="mt-1 h-1 overflow-hidden bg-secondary">
              <div
                className="h-full bg-primary/70"
                style={{ width: `${Math.round((row.minutes / maxMinutes) * 100)}%` }}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function usePatternsData() {
  const { streams, loading: streamsLoading } = useStreams();
  const searchParams = useSearchParams();
  const [timeZone, setTimeZone] = useState("");
  const [byHour, setByHour] = useState<PatternRow[]>([]);
  const [byDay, setByDay] = useState<PatternRow[]>([]);
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
    if (!timeZone || streamsLoading) return;
    setLoading(true);
    setError(null);
    try {
      const filter = parseTimeRange(range || undefined, from || undefined, to || undefined, timeZone);
      setByHour(computeStreamsByHour(streams, filter, timeZone));
      setByDay(computeStreamsByDayOfWeek(streams, filter, timeZone));
    } catch {
      setError("Could not load listening patterns.");
    } finally {
      setLoading(false);
    }
  }, [timeZone, range, from, to, streams, streamsLoading]);

  const derived = useMemo(() => {
    const peakHour =
      byHour.length > 0
        ? byHour.reduce((a, b) => (a.minutes >= b.minutes ? a : b))
        : null;
    const peakDay =
      byDay.length > 0
        ? byDay.reduce((a, b) => (a.minutes >= b.minutes ? a : b))
        : null;
    const topHours = [...byHour]
      .filter((r) => r.minutes > 0 || r.streams > 0)
      .sort((a, b) => b.minutes - a.minutes || b.streams - a.streams)
      .slice(0, 12);
    const topDays = [...byDay].sort(
      (a, b) => b.minutes - a.minutes || b.streams - a.streams
    );
    return { peakHour, peakDay, topHours, topDays };
  }, [byHour, byDay]);

  return {
    loading: loading || streamsLoading,
    error,
    ...derived,
  };
}

/** Compact sidebar column for the dashboard, beside Recent. */
export function PatternsSidePanel({ className }: { className?: string }) {
  const searchParams = useSearchParams();
  const { loading, error, peakHour, peakDay, topHours, topDays } = usePatternsData();
  const patternsHref = librarySectionHref(
    "patterns",
    new URLSearchParams(searchParams.toString())
  );

  return (
    <div className={cn("flex min-h-0 flex-col border border-border bg-card", className)}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Patterns
        </h2>
        <Link href={patternsHref} className="text-xs font-medium text-primary hover:underline">
          All
        </Link>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2">
        {loading ? (
          <p className="px-2 py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="px-2 py-8 text-center text-sm text-destructive">{error}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="border border-border bg-background p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Peak hour
                </p>
                <p className="mt-1 truncate text-sm font-semibold tabular-nums">
                  {peakHour?.label ?? "—"}
                </p>
              </div>
              <div className="border border-border bg-background p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Peak day
                </p>
                <p className="mt-1 truncate text-sm font-semibold">
                  {peakDay?.label ?? "—"}
                </p>
              </div>
            </div>
            <div>
              <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                By hour
              </p>
              <RankedMetricRows rows={topHours} empty="No hourly data." compact />
            </div>
            <div>
              <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                By weekday
              </p>
              <RankedMetricRows rows={topDays} empty="No weekday data." compact />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function HomePatternsSection() {
  const { loading, error, peakHour, peakDay, topHours, topDays } = usePatternsData();

  if (loading) {
    return (
      <div className="border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        Loading patterns…
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-destructive/30 bg-destructive/10 px-4 py-10 text-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <section id="patterns" className="scroll-mt-28 space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="border border-border bg-card p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Busiest hour
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums tracking-tight">
            {peakHour ? peakHour.label : "—"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {peakHour
              ? `${peakHour.minutes.toLocaleString()}m · ${peakHour.streams.toLocaleString()} plays`
              : "No plays in this range."}
          </p>
        </div>
        <div className="border border-border bg-card p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Busiest day
          </p>
          <p className="mt-2 text-xl font-semibold tracking-tight">
            {peakDay ? peakDay.label : "—"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {peakDay
              ? `${peakDay.minutes.toLocaleString()}m · ${peakDay.streams.toLocaleString()} plays`
              : "No plays in this range."}
          </p>
        </div>
      </div>

      <div className={cn("grid gap-3", "xl:grid-cols-2")}>
        <SectionBlock title="By hour">
          <ContentPanel>
            <RankedMetricRows rows={topHours} empty="No hourly data." />
          </ContentPanel>
        </SectionBlock>
        <SectionBlock title="By weekday">
          <ContentPanel>
            <RankedMetricRows rows={topDays} empty="No weekday data." />
          </ContentPanel>
        </SectionBlock>
      </div>
    </section>
  );
}
