import { cn } from "@/lib/utils";

export function InsightCard({
  label,
  primaryValue,
  detail,
  className,
}: {
  label: string;
  primaryValue: string;
  detail: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/40 bg-card/40 p-3",
        className
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-lg font-semibold tabular-nums tracking-tight text-primary">
        {primaryValue}
      </p>
      <p className="mt-1 text-xs leading-snug text-muted-foreground">{detail}</p>
    </div>
  );
}
