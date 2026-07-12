"use client";

import { Suspense } from "react";
import { TimeRangeTabs } from "@/components/time-range-tabs";
import { TopSortTabs } from "@/components/top-sort-tabs";

export type FilterToolbarContext = "dashboard" | "rankings" | "patterns" | "recent";

export function FilterToolbar({ context }: { context: FilterToolbarContext }) {
  const showSort = context === "dashboard" || context === "rankings";

  return (
    <div className="relative z-50 flex flex-col gap-3 border border-border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-6 sm:gap-y-2">
      <div className="min-w-0 space-y-1.5 sm:flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Period
        </p>
        <Suspense>
          <TimeRangeTabs />
        </Suspense>
      </div>
      {showSort ? (
        <div className="min-w-0 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Rank by
          </p>
          <Suspense>
            <TopSortTabs />
          </Suspense>
        </div>
      ) : null}
    </div>
  );
}
