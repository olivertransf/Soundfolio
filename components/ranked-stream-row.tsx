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
    <>
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
        <span className="w-7 shrink-0 text-right text-sm text-muted-foreground">{rank}</span>
        {leading}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{title}</p>
          {subtitle != null && subtitle !== "" ? (
            <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-3 text-xs tabular-nums text-muted-foreground sm:gap-4 sm:text-sm">
        <span
          className={cn(
            "flex items-center gap-1.5 whitespace-nowrap",
            primary === "minutes" && "font-medium text-foreground"
          )}
        >
          <Clock className="h-3.5 w-3.5 shrink-0" />
          {minutes.toLocaleString()} min
        </span>
        <span
          className={cn(
            "flex items-center gap-1.5",
            primary === "streams" && "font-medium text-foreground"
          )}
        >
          <Headphones className="h-3.5 w-3.5 shrink-0" />
          {streams.toLocaleString()} plays
        </span>
      </div>
    </>
  );

  const className = cn(
    "flex flex-col gap-1.5 rounded-lg px-2 transition-colors hover:bg-secondary/50 sm:flex-row sm:items-center sm:gap-4",
    padding === "compact" ? "py-2.5" : "py-3",
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
