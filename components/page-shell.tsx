import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function PageShell({
  children,
  className,
  width = "default",
}: {
  children: ReactNode;
  className?: string;
  width?: "wide" | "default" | "narrow";
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full space-y-3.5 sm:space-y-4",
        width === "wide" && "max-w-[1600px]",
        width === "default" && "max-w-[1320px]",
        width === "narrow" && "max-w-[1040px]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  meta,
  actions,
}: {
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-2.5 border-b border-border/30 pb-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-0.5">
        <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">{description}</p>
        ) : null}
        {meta ? <div className="pt-0.5">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionBlock({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ContentPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border/45 bg-card/65 p-2.5 shadow-none ring-1 ring-border/20 sm:p-3", className)}>
      {children}
    </div>
  );
}
