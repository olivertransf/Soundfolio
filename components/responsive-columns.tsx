import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Equal-width columns that expand on wider screens. */
export function ResponsiveColumns({
  children,
  className,
  cols = 3,
}: {
  children: ReactNode;
  className?: string;
  cols?: 2 | 3;
}) {
  return (
    <div
      className={cn(
        "grid min-w-0 gap-3",
        cols === 2 && "md:grid-cols-2",
        cols === 3 && "md:grid-cols-2 xl:grid-cols-3",
        className
      )}
    >
      {children}
    </div>
  );
}

export function RankColumn({
  title,
  children,
  className,
  stickyHeader = true,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  stickyHeader?: boolean;
}) {
  return (
    <div className={cn("min-w-0 border border-border bg-card", className)}>
      <div
        className={cn(
          "border-b border-border bg-card px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
          stickyHeader && "sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-10"
        )}
      >
        {title}
      </div>
      <div className="p-1.5 sm:p-2">{children}</div>
    </div>
  );
}
