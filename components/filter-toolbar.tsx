"use client";

import { Suspense } from "react";
import { TimeRangeTabs } from "@/components/time-range-tabs";
import { TopSortTabs } from "@/components/top-sort-tabs";

export type FilterToolbarContext = "dashboard" | "rankings" | "patterns" | "recent";

export function FilterToolbar({ context }: { context: FilterToolbarContext }) {
  return (
    <div className="space-y-3">
      <div className="min-w-0 space-y-1.5 overflow-visible">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Period
        </p>
        <Suspense>
          <TimeRangeTabs />
        </Suspense>
      </div>
      {(context === "dashboard" || context === "rankings") && (
        <div className="min-w-0 space-y-1.5 overflow-visible">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Rank by
          </p>
          <Suspense>
            <TopSortTabs />
          </Suspense>
        </div>
      )}
    </div>
  );
}
