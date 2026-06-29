import type { ReactNode } from "react";
import { RankedStreamRow } from "@/components/ranked-stream-row";
import { cn } from "@/lib/utils";
import type { TopSortBy } from "@/lib/top-sort";

export type RankedEntityItem = {
  key: string;
  href?: string;
  title: string;
  subtitle?: string;
  streams: number;
  minutes: number;
  leading: ReactNode;
};

export function RankedEntityList({
  items,
  sortBy = "minutes",
  columns = "auto",
  empty = "No data for this time range.",
  className,
}: {
  items: RankedEntityItem[];
  sortBy?: TopSortBy;
  columns?: "one" | "two" | "three" | "auto";
  empty?: string;
  className?: string;
}) {
  if (items.length === 0) {
    return <p className="px-2 py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <div
      className={cn(
        "grid gap-x-2 gap-y-0.5",
        columns === "one" && "grid-cols-1",
        columns === "two" && "md:grid-cols-2",
        columns === "three" && "md:grid-cols-2 xl:grid-cols-3",
        columns === "auto" && "md:grid-cols-2 2xl:grid-cols-3",
        className
      )}
    >
      {items.map((item, i) => (
        <RankedStreamRow
          key={item.key}
          rank={i + 1}
          href={item.href}
          leading={item.leading}
          title={item.title}
          subtitle={item.subtitle}
          streams={item.streams}
          minutes={item.minutes}
          sortBy={sortBy}
          padding="compact"
        />
      ))}
    </div>
  );
}
