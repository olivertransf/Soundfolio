"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type CoverItem = {
  key: string;
  href?: string;
  onSelect?: () => void;
  title: string;
  subtitle?: string;
  minutes?: number;
  plays?: number;
  detail?: string;
  rank?: number;
  active?: boolean;
  art: ReactNode;
};

function metaLine(item: CoverItem) {
  const amount = [
    item.minutes != null ? `${item.minutes.toLocaleString()} min` : null,
    item.plays != null ? `${item.plays.toLocaleString()} plays` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return [item.detail, amount].filter(Boolean).join(" · ");
}

export function CoverRail({
  title,
  items,
  size = "rail",
  shape = "square",
}: {
  title?: string;
  items: CoverItem[];
  size?: "rail" | "hero";
  shape?: "square" | "round";
}) {
  if (items.length === 0) return null;
  const hero = size === "hero";

  return (
    <section className="min-w-0 space-y-3">
      {title ? <h2 className="text-sm font-semibold tracking-tight">{title}</h2> : null}
      <div
        className={cn(
          "grid gap-x-4 gap-y-5",
          hero ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
        )}
      >
        {items.map((item) => {
          const meta = metaLine(item);
          const face = (
            <>
              <div
                className={cn(
                  "relative aspect-square overflow-hidden bg-secondary",
                  shape === "round" ? "rounded-full" : "rounded-xl",
                  item.active && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                )}
              >
                {item.art}
              </div>
              <div className="mt-2 min-w-0 space-y-0.5">
                <p className="truncate text-sm font-medium leading-tight">
                  {item.rank ? (
                    <span className="mr-1.5 tabular-nums text-muted-foreground">{item.rank}</span>
                  ) : null}
                  {item.title}
                </p>
                {item.subtitle ? (
                  <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                ) : null}
                {meta ? (
                  <p className="truncate text-[11px] tabular-nums text-muted-foreground">{meta}</p>
                ) : null}
              </div>
            </>
          );
          const className =
            "min-w-0 text-left outline-none transition-opacity hover:opacity-80 focus-visible:opacity-80";
          if (item.href) {
            return (
              <Link key={item.key} href={item.href} className={className}>
                {face}
              </Link>
            );
          }
          if (item.onSelect) {
            return (
              <button key={item.key} type="button" onClick={item.onSelect} className={className}>
                {face}
              </button>
            );
          }
          return (
            <div key={item.key} className={className}>
              {face}
            </div>
          );
        })}
      </div>
    </section>
  );
}
