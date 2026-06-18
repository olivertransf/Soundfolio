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
        "rounded-2xl border border-border/40 bg-card/40 p-4",
        className
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-display text-xl font-semibold tabular-nums tracking-tight text-primary">
        {primaryValue}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}
