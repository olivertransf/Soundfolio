"use client";

import { Suspense } from "react";
import { TimeRangeTabs } from "@/components/time-range-tabs";
import { TopSortTabs } from "@/components/top-sort-tabs";

export type FilterToolbarContext = "dashboard" | "rankings" | "patterns" | "recent";

export function FilterToolbar({ context }: { context: FilterToolbarContext }) {
  const showSort = context === "dashboard" || context === "rankings";

  return (
    <div className="rounded-2xl border border-border/50 bg-card/35 p-3 sm:p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-8 lg:gap-y-3">
        <div className="min-w-0 space-y-1.5 overflow-visible lg:flex-1 lg:min-w-[12rem]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Period
          </p>
          <Suspense>
            <TimeRangeTabs />
          </Suspense>
        </div>
        {showSort ? (
          <div className="min-w-0 space-y-1.5 overflow-visible lg:w-auto">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Rank by
            </p>
            <Suspense>
              <TopSortTabs />
            </Suspense>
          </div>
        ) : null}
      </div>
    </div>
  );
}
