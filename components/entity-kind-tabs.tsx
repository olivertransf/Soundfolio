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
    <div className={cn("inline-flex rounded-lg border border-border/40 bg-card/40 p-0.5", className)}>
      {kinds.map((kind) => (
        <button
          key={kind}
          type="button"
          onClick={() => onValueChange(kind)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            value === kind
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
          )}
        >
          {labels[kind]}
        </button>
      ))}
    </div>
  );
}
