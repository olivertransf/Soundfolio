"use client";

import { cn } from "@/lib/utils";

export type EntityKind = "tracks" | "artists" | "albums";

const labels: Record<EntityKind, string> = {
  tracks: "Tracks",
  artists: "Artists",
  albums: "Albums",
};

export function EntityKindTabs({
  value,
  onValueChange,
  className,
  kinds = ["tracks", "artists", "albums"],
}: {
  value: EntityKind;
  onValueChange: (value: EntityKind) => void;
  className?: string;
  kinds?: EntityKind[];
}) {
  return (
    <div
      role="tablist"
      aria-label="Entity type"
      className={cn("flex w-full border border-border bg-card p-0.5 sm:w-auto", className)}
    >
      {kinds.map((kind) => (
        <button
          key={kind}
          type="button"
          role="tab"
          aria-selected={value === kind}
          onClick={() => onValueChange(kind)}
          className={cn(
            "min-h-11 flex-1 px-3 py-2 text-xs font-medium transition-colors sm:flex-none sm:min-w-[5.5rem]",
            value === kind
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          {labels[kind]}
        </button>
      ))}
    </div>
  );
}
