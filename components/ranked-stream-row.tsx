import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { TopSortBy } from "@/lib/top-sort";

type RankedStreamRowProps = {
  rank: number;
  leading: ReactNode;
  title: string;
  subtitle?: string;
  streams: number;
  minutes: number;
  sortBy?: TopSortBy;
  padding?: "default" | "compact";
  href?: string;
};

export function RankedStreamRow({
  rank,
  leading,
  title,
  subtitle,
  streams,
  minutes,
  sortBy = "minutes",
  padding = "default",
  href,
}: RankedStreamRowProps) {
  const metric =
    sortBy === "streams" ? streams.toLocaleString() : `${minutes.toLocaleString()}m`;

  const content = (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {rank}
      </span>
      {leading}
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="truncate text-sm font-medium leading-tight">{title}</p>
        {subtitle != null && subtitle !== "" ? (
          <p className="truncate text-xs leading-tight text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <span className="shrink-0 text-xs font-medium tabular-nums text-foreground">
        {metric}
      </span>
    </div>
  );

  const className = cn(
    "flex px-1.5 transition-colors hover:bg-secondary/60",
    padding === "compact" ? "py-1.5" : "py-2",
    href && "cursor-pointer"
  );

  const wrapped = (
    <div data-row className={className}>
      {content}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        <div data-row className={className}>
          {content}
        </div>
      </Link>
    );
  }

  return wrapped;
}
