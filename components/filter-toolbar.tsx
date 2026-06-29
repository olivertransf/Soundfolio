"use client";

import { Suspense } from "react";
import { TimeRangeTabs } from "@/components/time-range-tabs";
import { TopSortTabs } from "@/components/top-sort-tabs";

export type FilterToolbarContext = "dashboard" | "rankings" | "patterns" | "recent";

export function FilterToolbar({ context }: { context: FilterToolbarContext }) {
  const showSort = context === "dashboard" || context === "rankings";

  return (
    <div className="rounded-xl border border-border/45 bg-card/35 p-2.5 sm:p-3">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-5 lg:gap-y-2">
        <div className="min-w-0 space-y-1 overflow-visible lg:flex-1 lg:min-w-[12rem]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Period
          </p>
          <Suspense>
            <TimeRangeTabs />
          </Suspense>
        </div>
        {showSort ? (
          <div className="min-w-0 space-y-1 overflow-visible lg:w-auto">
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
