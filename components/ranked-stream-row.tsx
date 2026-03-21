import type { ReactNode } from "react";
import { Clock, Headphones } from "lucide-react";
import { cn } from "@/lib/utils";

type RankedStreamRowProps = {
  rank: number;
  leading: ReactNode;
  title: string;
  subtitle?: string;
  streams: number;
  minutes: number;
  padding?: "default" | "compact";
};

export function RankedStreamRow({
  rank,
  leading,
  title,
  subtitle,
  streams,
  minutes,
  padding = "default",
}: RankedStreamRowProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg px-2 transition-colors hover:bg-secondary/50 sm:flex-row sm:items-center sm:gap-4",
        padding === "compact" ? "py-2.5" : "py-3"
      )}
    >
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
        <span className="flex items-center gap-1.5">
          <Headphones className="h-3.5 w-3.5 shrink-0" />
          {streams.toLocaleString()}
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          {minutes.toLocaleString()} min
        </span>
      </div>
    </div>
  );
}
