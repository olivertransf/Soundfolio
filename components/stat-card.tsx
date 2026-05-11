import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

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
    <Card
      className={cn(
        "border-border/60 bg-card/80 shadow-none ring-1 ring-border/40 transition-colors hover:ring-border/70",
        compact && "rounded-xl"
      )}
    >
      <CardContent className={cn(compact ? "p-3 pt-3" : "pt-6")}>
        <div
          className={cn(
            "flex items-start justify-between gap-2",
            compact && "gap-2.5"
          )}
        >
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
                "font-display font-semibold tabular-nums tracking-tight",
                compact
                  ? "mt-0.5 text-lg leading-none sm:text-xl"
                  : "mt-1.5 text-2xl sm:text-3xl"
              )}
            >
              {value}
            </p>
            {sub ? (
              <p
                className={cn(
                  "text-muted-foreground",
                  compact ? "mt-0.5 line-clamp-1 text-[10px] leading-tight" : "mt-1 text-xs"
                )}
              >
                {sub}
              </p>
            ) : null}
          </div>
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-xl bg-primary/12 ring-1 ring-primary/20",
              compact ? "size-8 [&_svg]:size-3.5" : "h-10 w-10 [&_svg]:h-5 [&_svg]:w-5"
            )}
          >
            <Icon className="text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
