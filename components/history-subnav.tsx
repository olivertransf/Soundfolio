"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  defaultStatsNavQuery,
  getStoredTimeFilter,
  statsQueryFromStoredFilter,
} from "@/lib/stats-session-preferences";

export function HistorySubnav() {
  const pathname = usePathname();
  const [statsNavQuery, setStatsNavQuery] = useState(() => defaultStatsNavQuery());

  useEffect(() => {
    setStatsNavQuery(statsQueryFromStoredFilter(getStoredTimeFilter()));
  }, [pathname]);

  const chartHref = `/history?${statsNavQuery}`;
  const items = [
    { href: chartHref, label: "Chart", active: pathname === "/history" },
    { href: "/history/recent", label: "Recent", active: pathname.startsWith("/history/recent") },
    { href: "/history/import", label: "Import", active: pathname.startsWith("/history/import") },
  ];

  return (
    <nav
      className="flex w-full max-w-full gap-1 overflow-x-auto rounded-xl border border-border/60 bg-secondary/20 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="History sections"
    >
      {items.map(({ href, label, active }) => (
        <Link
          key={label}
          href={href}
          className={cn(
            "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            active
              ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
              : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
