"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { FilterToolbar } from "@/components/filter-toolbar";
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
    <div className="mx-auto max-w-[1600px] space-y-4 sm:space-y-5">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Library</h1>
        <p className="text-sm text-muted-foreground">
          Explore recent plays, rankings, and listening patterns.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-border/40 bg-card/30 p-1">
        {sections.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSection(item.id)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              section === item.id
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {section === "recent" ? <LibraryRecentSection /> : null}
      {section === "rankings" ? <LibraryRankingsSection /> : null}
      {section === "patterns" ? <LibraryPatternsSection /> : null}
    </div>
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
