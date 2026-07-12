import type { ReactNode } from "react";
import { ContentPanel } from "@/components/page-shell";
import { cn } from "@/lib/utils";

export function EntityHero({
  eyebrow,
  title,
  subtitle,
  stats,
  artwork,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  stats?: ReactNode;
  artwork: ReactNode;
  children?: ReactNode;
}) {
  return (
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
          <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {subtitle ? <div className="mt-0.5 text-sm text-muted-foreground">{subtitle}</div> : null}
          {stats ? (
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">{stats}</div>
          ) : null}
          {children ? <div className="mt-3">{children}</div> : null}
        </div>
      </div>
    </ContentPanel>
  );
}

export function EntityStatPill({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("rounded-full border border-border/40 bg-secondary/35 px-2.5 py-1", className)}>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium text-foreground">{value}</span>
    </span>
  );
}
