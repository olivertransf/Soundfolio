"use client";

import { Suspense } from "react";
import { FilterToolbar } from "@/components/filter-toolbar";
import { HomePatternsSection } from "@/components/home-patterns-section";

function PatternsSectionInner() {
  return (
    <div className="space-y-3">
      <FilterToolbar context="patterns" />
      <HomePatternsSection />
    </div>
  );
}

export function LibraryPatternsSection() {
  return (
    <Suspense
      fallback={
        <div className="border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Loading patterns…
        </div>
      }
    >
      <PatternsSectionInner />
    </Suspense>
  );
}
