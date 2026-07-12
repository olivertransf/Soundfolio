"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { TOP_SORT_PARAM, type TopSortBy } from "@/lib/top-sort";
import {
  getStoredTopSort,
  setStoredTopSort,
} from "@/lib/stats-session-preferences";

const options: { value: TopSortBy; label: string }[] = [
  { value: "minutes", label: "Time" },
  { value: "streams", label: "Plays" },
];

export function TopSortTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sort = searchParams.get(TOP_SORT_PARAM) === "streams" ? "streams" : "minutes";
  const hydratedFromStorage = useRef(false);

  useEffect(() => {
    if (hydratedFromStorage.current) return;
    if (searchParams.has(TOP_SORT_PARAM)) {
      hydratedFromStorage.current = true;
      return;
    }
    const stored = getStoredTopSort();
    hydratedFromStorage.current = true;
    if (stored === "minutes") return;
    const params = new URLSearchParams(searchParams.toString());
    params.set(TOP_SORT_PARAM, stored);
    router.replace(`?${params.toString()}`);
  }, [router, searchParams]);

  function apply(next: TopSortBy) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "minutes") params.delete(TOP_SORT_PARAM);
    else params.set(TOP_SORT_PARAM, next);
    setStoredTopSort(next);
    router.push(`?${params.toString()}`);
  }

  return (
    <div
      role="tablist"
      aria-label="Rank by"
      className="flex w-full border border-border bg-background p-0.5 sm:w-auto"
    >
      {options.map((o) => {
        const active = sort === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => apply(o.value)}
            className={cn(
              "min-h-11 flex-1 px-3 py-2 text-xs font-medium transition-colors sm:flex-none sm:min-w-[4.5rem]",
              active
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
