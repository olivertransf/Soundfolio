"use client";

import { Suspense } from "react";
import { TimeRangeTabs } from "@/components/time-range-tabs";
import { TopSortTabs } from "@/components/top-sort-tabs";

export function TopListToolbar() {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2 sm:gap-4">
      <div className="min-w-0 space-y-1.5 overflow-visible">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Period
        </p>
        <Suspense>
          <TimeRangeTabs />
        </Suspense>
      </div>
      <div className="min-w-0 space-y-1.5 overflow-visible">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Rank by
        </p>
        <Suspense>
          <TopSortTabs />
        </Suspense>
      </div>
    </div>
  );
}
