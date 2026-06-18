"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FilterToolbar } from "@/components/filter-toolbar";
import { HomePatternsSection } from "@/components/home-patterns-section";
import { parseTimeRange } from "@/lib/stats-compute";
import { VIEWER_TIMEZONE_PARAM } from "@/lib/stats-timezone";
import {
  detectViewerTimeZone,
  readViewerTimeZoneCookie,
} from "@/lib/viewer-timezone-client";

function PatternsSectionInner() {
  const searchParams = useSearchParams();
  const range = searchParams.get("range") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const viewerTimeZone =
    searchParams.get(VIEWER_TIMEZONE_PARAM) ??
    readViewerTimeZoneCookie() ??
    detectViewerTimeZone();
  const filter = parseTimeRange(range, from, to, viewerTimeZone ?? undefined);

  return (
    <div className="space-y-4">
      <FilterToolbar context="patterns" />
      <p className="text-sm text-muted-foreground">
        Hours use your local timezone
        {viewerTimeZone ? ` (${viewerTimeZone.replace(/_/g, " ")})` : ""}.
      </p>
      <HomePatternsSection periodLabel={filter.label} />
    </div>
  );
}

export function LibraryPatternsSection() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-border/40 bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
          Loading patterns…
        </div>
      }
    >
      <PatternsSectionInner />
    </Suspense>
  );
}
