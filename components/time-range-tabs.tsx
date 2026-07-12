"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
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
  { value: "3m", label: "3m" },
  { value: "6m", label: "6m" },
  { value: "1y", label: "1y" },
  { value: "ytd", label: "YTD" },
  { value: "all", label: "All" },
] as const;

function withViewerTimeZone(params: URLSearchParams) {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) params.set(VIEWER_TIMEZONE_PARAM, tz);
  } catch {
    // no-op
  }
  return params;
}

export function TimeRangeTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const isCustom = Boolean(from && to);
  const range = searchParams.get("range") ?? DEFAULT_TIME_RANGE;

  const [customFrom, setCustomFrom] = useState(from || "");
  const [customTo, setCustomTo] = useState(to || "");
  const [customOpen, setCustomOpen] = useState(false);
  const hydratedFromStorage = useRef(false);

  useEffect(() => {
    setCustomFrom(from || "");
    setCustomTo(to || "");
  }, [from, to]);

  function hrefFor(params: URLSearchParams) {
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function presetHref(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("from");
    params.delete("to");
    params.set("range", value);
    withViewerTimeZone(params);
    return hrefFor(params);
  }

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
    withViewerTimeZone(params);
    router.replace(hrefFor(params), { scroll: false });
  }, [router, searchParams, pathname]);

  function applyCustom() {
    if (!customFrom || !customTo) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("range");
    params.set("from", customFrom);
    params.set("to", customTo);
    withViewerTimeZone(params);
    setStoredTimeFilter({ kind: "custom", from: customFrom, to: customTo });
    router.push(hrefFor(params), { scroll: false });
    setCustomOpen(false);
  }

  const customLabel =
    isCustom && from && to ? `${from} → ${to}` : "Custom";

  return (
    <div className="flex flex-wrap gap-1">
      <div
        role="tablist"
        aria-label="Time period"
        className="flex flex-wrap border border-border bg-background p-0.5"
      >
        {presets.map((p) => {
          const active = !isCustom && range === p.value;
          return (
            <Link
              key={p.value}
              href={presetHref(p.value)}
              scroll={false}
              role="tab"
              aria-selected={active}
              onClick={() => {
                setStoredTimeFilter({ kind: "preset", range: p.value });
                setCustomOpen(false);
              }}
              className={cn(
                "inline-flex min-h-11 items-center px-2.5 py-2 text-xs font-medium sm:px-3",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {p.label}
            </Link>
          );
        })}
      </div>

      <Popover open={customOpen} onOpenChange={setCustomOpen}>
        <PopoverTrigger
          type="button"
          className={cn(
            "inline-flex min-h-11 items-center border border-border px-3 py-2 text-xs font-medium",
            isCustom
              ? "bg-primary/15 text-primary"
              : "bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          {customLabel}
        </PopoverTrigger>
        <PopoverContent className="w-[min(100vw-2rem,18rem)] space-y-3 p-3" align="start">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">From</label>
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">To</label>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-10"
            />
          </div>
          <button
            type="button"
            onClick={applyCustom}
            className="h-10 w-full bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Apply
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
