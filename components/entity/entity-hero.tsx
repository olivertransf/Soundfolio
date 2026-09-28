import type { ReactNode } from "react";
import { ContentPanel } from "@/components/page-shell";

export type StatFigure = {
  label: string;
  value: ReactNode;
  hint?: string;
};

export function StatRow({ items }: { items: StatFigure[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 border border-border bg-card px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {item.label}
          </p>
          <p className="truncate text-xl font-semibold tabular-nums">{item.value}</p>
          {item.hint ? <p className="truncate text-xs text-muted-foreground">{item.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function EntityHero({
  eyebrow,
  title,
  subtitle,
  figures,
  artwork,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  figures?: StatFigure[];
  artwork: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <ContentPanel className="p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
          <div className="size-24 shrink-0 overflow-hidden rounded-xl bg-secondary sm:size-28">
            {artwork}
          </div>
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            {subtitle ? <div className="mt-0.5 text-sm text-muted-foreground">{subtitle}</div> : null}
          </div>
        </div>
        {children ? <div className="mt-3">{children}</div> : null}
      </ContentPanel>
      {figures && figures.length > 0 ? <StatRow items={figures} /> : null}
    </div>
  );
}
