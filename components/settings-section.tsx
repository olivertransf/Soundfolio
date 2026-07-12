import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SettingsSection({
  title,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border border-border bg-card p-3 sm:p-4", className)}>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}
