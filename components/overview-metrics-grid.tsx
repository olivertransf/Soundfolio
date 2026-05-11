import { cn } from "@/lib/utils";

export type OverviewMetric = {
  label: string;
  value: string;
  hint?: string;
};

/** Single panel: 3×2 on small screens, one row of 6 from `sm` up. */
export function OverviewMetricsGrid({
  metrics,
  className,
}: {
  metrics: OverviewMetric[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/40 bg-border/15 p-px shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]",
        className
      )}
    >
      <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-[15px] sm:grid-cols-6">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="min-w-0 bg-card/80 px-3 py-3 text-center sm:px-4 sm:py-3.5 sm:text-left"
          >
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {m.label}
            </dt>
            <dd className="mt-1 font-display text-base font-semibold tabular-nums leading-none tracking-tight text-foreground sm:text-lg">
              {m.value}
            </dd>
            {m.hint ? (
              <dd className="mt-1 truncate text-xs leading-snug text-muted-foreground">{m.hint}</dd>
            ) : null}
          </div>
        ))}
      </dl>
    </div>
  );
}
