"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart3, Clock, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader, PageShell } from "@/components/page-shell";
import { PageHistoryActions } from "@/components/page-history-actions";
import { LibraryRecentSection } from "@/components/library/recent-section";
import { LibraryRankingsSection } from "@/components/library/rankings-section";
import { LibraryPatternsSection } from "@/components/library/patterns-section";

const sections = [
  { id: "recent", label: "Recent", description: "Latest listens", icon: Clock },
  { id: "rankings", label: "Rankings", description: "Top tracks, artists, albums", icon: Trophy },
  { id: "patterns", label: "Patterns", description: "When and how you listen", icon: BarChart3 },
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
    <PageShell width="wide">
      <PageHeader
        title="Library"
        description="Explore recent plays, rankings, and listening patterns."
        actions={<PageHistoryActions />}
      />

      <div className="grid gap-3 lg:grid-cols-[9.5rem_minmax(0,1fr)] lg:items-start">
        <nav
          className="flex gap-1 overflow-x-auto rounded-xl border border-border/40 bg-card/30 p-1 lg:sticky lg:top-[calc(4.25rem+env(safe-area-inset-top,0px))] lg:flex-col lg:overflow-visible lg:p-1.5"
          aria-label="Library sections"
        >
          {sections.map((item) => {
            const Icon = item.icon;
            const isActive = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={cn(
                  "flex min-w-[7.25rem] shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors lg:min-w-0 lg:w-full",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                )}
              >
                <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-xs font-medium leading-tight">{item.label}</span>
                  <span className="hidden text-[11px] leading-tight text-muted-foreground lg:block">
                    {item.description}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 space-y-3">
          {section === "recent" ? <LibraryRecentSection /> : null}
          {section === "rankings" ? <LibraryRankingsSection /> : null}
          {section === "patterns" ? <LibraryPatternsSection /> : null}
        </div>
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
