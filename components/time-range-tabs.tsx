"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_TIME_RANGE } from "@/lib/time-range";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { VIEWER_TIMEZONE_PARAM } from "@/lib/stats-timezone";
import {
  getStoredTimeFilter,
  setStoredTimeFilter,
} from "@/lib/stats-session-preferences";

const presets = [
  { value: "30d", label: "30d" },
  { value: "3m", label: "3 mo" },
  { value: "6m", label: "6 mo" },
  { value: "1y", label: "1 yr" },
  { value: "ytd", label: "This year" },
  { value: "all", label: "All time" },
] as const;

function periodButtonLabel(
  range: string,
  from: string,
  to: string,
  isCustom: boolean
): string {
  if (isCustom && from && to) return `${from} → ${to}`;
  const preset = presets.find((p) => p.value === range);
  return preset?.label ?? "This year";
}

export function TimeRangeTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const isCustom = Boolean(from && to);

  const range = searchParams.get("range") ?? DEFAULT_TIME_RANGE;

  const [customFrom, setCustomFrom] = useState(from || "");
  const [customTo, setCustomTo] = useState(to || "");
  const [open, setOpen] = useState(false);
  const [customExpanded, setCustomExpanded] = useState(false);
  const hydratedFromStorage = useRef(false);

  useEffect(() => {
    setCustomFrom(from || "");
    setCustomTo(to || "");
  }, [from, to]);

  useEffect(() => {
    if (hydratedFromStorage.current) return;
    const hasCustom = Boolean(searchParams.get("from") && searchParams.get("to"));
    const hasPreset = searchParams.has("range");
    if (hasCustom || hasPreset) {
      hydratedFromStorage.current = true;
      return;
    }
    const stored = getStoredTimeFilter();
    if (!stored) {
      hydratedFromStorage.current = true;
      return;
    }
    hydratedFromStorage.current = true;
    const params = new URLSearchParams(searchParams.toString());
    if (stored.kind === "preset") {
      params.delete("from");
      params.delete("to");
      params.set("range", stored.range);
    } else {
      params.delete("range");
      params.set("from", stored.from);
      params.set("to", stored.to);
    }
    if (!params.has(VIEWER_TIMEZONE_PARAM)) {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) params.set(VIEWER_TIMEZONE_PARAM, tz);
      } catch {
        // ignore
      }
    }
    router.replace(`?${params.toString()}`);
  }, [router, searchParams]);

  useEffect(() => {
    if (!open) {
      setCustomExpanded(false);
      return;
    }
    setCustomExpanded(isCustom);
  }, [open, isCustom]);

  function applyViewerTimeZone(params: URLSearchParams) {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) params.set(VIEWER_TIMEZONE_PARAM, tz);
    } catch {
      // no-op: keep links functional even if timezone detection fails
    }
  }

  function applyPreset(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("from");
    params.delete("to");
    params.set("range", value);
    applyViewerTimeZone(params);
    setStoredTimeFilter({ kind: "preset", range: value });
    router.push(`?${params.toString()}`);
    setOpen(false);
    setCustomExpanded(false);
  }

  function applyCustom() {
    if (!customFrom || !customTo) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("range");
    params.set("from", customFrom);
    params.set("to", customTo);
    applyViewerTimeZone(params);
    setStoredTimeFilter({ kind: "custom", from: customFrom, to: customTo });
    router.push(`?${params.toString()}`);
    setOpen(false);
    setCustomExpanded(false);
  }

  const summary = periodButtonLabel(range, from, to, isCustom);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        className={cn(
          "box-border inline-flex min-h-10 w-full min-w-0 max-w-full items-center justify-between gap-2 rounded-xl border border-border/60 bg-secondary/25 px-3 py-2 text-left text-sm font-medium leading-snug text-foreground shadow-none outline-none transition-colors hover:bg-secondary/40 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 sm:w-auto sm:min-w-[11rem]"
        )}
      >
        <span className="min-w-0 truncate" title={summary}>
          {summary}
        </span>
        <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        className="flex w-[min(100vw-2rem,20rem)] flex-col gap-0 p-0 sm:min-w-[12rem]"
        align="start"
      >
        <div className="flex max-h-[min(50vh,18rem)] flex-col gap-0.5 overflow-y-auto p-1">
          {presets.map((p) => (
            <button
              key={p.value}
              type="button"
              className={cn(
                "rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                !isCustom && range === p.value
                  ? "bg-primary/15 font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              onClick={() => applyPreset(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="border-t border-border/60 p-1">
          <button
            type="button"
            className={cn(
              "flex w-full rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
              isCustom
                ? "bg-primary/15 font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            onClick={() => setCustomExpanded((e) => !e)}
          >
            Custom range…
          </button>
          {customExpanded ? (
            <div className="space-y-3 border-t border-border/40 px-2 pb-2 pt-3">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">From</label>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">To</label>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-8"
                />
              </div>
              <button
                type="button"
                onClick={applyCustom}
                className="h-8 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Apply
              </button>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
