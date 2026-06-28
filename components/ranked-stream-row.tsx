import type { ReactNode } from "react";
import Link from "next/link";
import { Clock, Headphones } from "lucide-react";
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
  const primary = sortBy === "streams" ? "streams" : "minutes";
  const content = (
    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
      <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:w-6 sm:text-sm">
        {rank}
      </span>
      {leading}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">{title}</p>
        {subtitle != null && subtitle !== "" ? (
          <p className="truncate text-xs leading-tight text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-[11px] tabular-nums text-muted-foreground sm:gap-2.5 sm:text-xs">
        <span
          className={cn(
            "flex items-center gap-1 whitespace-nowrap",
            primary === "minutes" ? "font-medium text-foreground" : "hidden sm:flex"
          )}
        >
          <Clock className="size-3 shrink-0" />
          {minutes.toLocaleString()}m
        </span>
        <span
          className={cn(
            "flex items-center gap-1 whitespace-nowrap",
            primary === "streams" ? "font-medium text-foreground" : "hidden sm:flex"
          )}
        >
          <Headphones className="size-3 shrink-0" />
          {streams.toLocaleString()}
        </span>
      </div>
    </div>
  );

  const className = cn(
    "flex rounded-md px-1.5 transition-colors hover:bg-secondary/50 sm:px-2",
    padding === "compact" ? "py-1.5" : "py-2",
    href && "cursor-pointer"
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
