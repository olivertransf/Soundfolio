"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { PageHeader, PageShell } from "@/components/page-shell";
import { LibraryRecentSection } from "@/components/library/recent-section";
import { LibraryRankingsSection } from "@/components/library/rankings-section";
import { LibraryPatternsSection } from "@/components/library/patterns-section";

const sections = [
  { id: "recent", label: "Recent" },
  { id: "rankings", label: "Rankings" },
  { id: "patterns", label: "Patterns" },
] as const;

type LibrarySection = (typeof sections)[number]["id"];

function LibraryContentInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = (searchParams.get("section") as LibrarySection | null) ?? "recent";

  const setSection = (next: LibrarySection) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", next);
    router.replace(`/library?${params.toString()}`);
  };

  return (
    <PageShell>
      <PageHeader title="Library" />

      <nav
        role="tablist"
        aria-label="Library sections"
        className="flex w-full border border-border bg-card p-0.5"
      >
        {sections.map((item) => {
          const isActive = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setSection(item.id)}
              className={cn(
                "min-h-11 flex-1 px-3 py-2 text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 space-y-3">
        {section === "recent" ? <LibraryRecentSection /> : null}
        {section === "rankings" ? <LibraryRankingsSection /> : null}
        {section === "patterns" ? <LibraryPatternsSection /> : null}
      </div>
    </PageShell>
  );
}

export function LibraryContent() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
          Loading library…
        </div>
      }
    >
      <LibraryContentInner />
    </Suspense>
  );
}

export function librarySectionHref(section: LibrarySection, searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams.toString());
  params.set("section", section);
  return `/library?${params.toString()}`;
}
