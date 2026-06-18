"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { createNavLinks } from "@/lib/nav-links";
import {
  defaultStatsNavQuery,
  getStoredTimeFilter,
  statsQueryFromStoredFilter,
} from "@/lib/stats-session-preferences";
import { pathMatchesNav } from "@/lib/nav-match";

export function Nav() {
  const pathname = usePathname();
  const [statsNavQuery, setStatsNavQuery] = useState(() => defaultStatsNavQuery());

  useEffect(() => {
    setStatsNavQuery(statsQueryFromStoredFilter(getStoredTimeFilter()));
  }, [pathname]);

  const { all: links } = createNavLinks("main", statsNavQuery);

  return (
    <nav className="fixed left-0 top-0 flex h-full w-56 flex-col gap-1 border-r border-border bg-card px-4 py-6">
      <div className="mb-6 px-2">
        <span className="text-xl font-bold">
          <span className="text-primary">Sound</span>
          <span className="text-foreground">folio</span>
        </span>
      </div>
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            pathMatchesNav(pathname, href)
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
