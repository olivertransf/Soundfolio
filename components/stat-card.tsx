import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  variant?: "default" | "compact";
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  variant = "default",
}: StatCardProps) {
  const compact = variant === "compact";
  return (
    <div className="border border-border bg-card p-2.5 sm:p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "font-medium uppercase tracking-wider text-muted-foreground",
              compact ? "text-[10px] leading-tight" : "text-xs"
            )}
          >
            {label}
          </p>
          <p
            className={cn(
              "font-semibold tabular-nums tracking-tight",
              compact ? "mt-0.5 text-base leading-none sm:text-lg" : "mt-1.5 text-2xl"
            )}
          >
            {value}
          </p>
          {sub ? (
            <p
              className={cn(
                "text-muted-foreground",
                compact ? "mt-0.5 line-clamp-1 text-[10px]" : "mt-1 text-xs"
              )}
            >
              {sub}
            </p>
          ) : null}
        </div>
        <Icon
          className={cn("shrink-0 text-primary", compact ? "size-3.5" : "size-5")}
          aria-hidden
        />
      </div>
    </div>
  );
}
