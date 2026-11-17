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
  detail?: string;
  active?: boolean;
  art: ReactNode;
};

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

  return (
    <section className="min-w-0 space-y-2">
      {title ? <h2 className="text-sm font-semibold tracking-tight">{title}</h2> : null}
      <div className="flex snap-x gap-3 overflow-x-auto pb-2">
        {items.map((item) => {
          const face = (
            <>
              <div
                className={cn(
                  "aspect-square overflow-hidden bg-secondary",
                  shape === "round" ? "rounded-full" : size === "hero" ? "rounded-2xl" : "rounded-xl",
                  item.active && "ring-2 ring-primary"
                )}
              >
                {item.art}
              </div>
              <p className="truncate text-xs font-medium">{item.title}</p>
              {item.subtitle ? (
                <p className="truncate text-[11px] text-muted-foreground">{item.subtitle}</p>
              ) : null}
              {item.detail ? (
                <p className="truncate text-[11px] tabular-nums text-muted-foreground">{item.detail}</p>
              ) : item.minutes != null ? (
                <p className="truncate text-[11px] tabular-nums text-muted-foreground">
                  {item.minutes.toLocaleString()}m
                </p>
              ) : null}
            </>
          );
          const className = cn(
            "snap-start text-left",
            size === "hero" ? "w-36 shrink-0 sm:w-44" : "w-28 shrink-0"
          );
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
