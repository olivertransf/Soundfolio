"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { TOP_SORT_PARAM, type TopSortBy } from "@/lib/top-sort";
import {
  getStoredTopSort,
  setStoredTopSort,
} from "@/lib/stats-session-preferences";

const options: { value: TopSortBy; label: string }[] = [
  { value: "minutes", label: "Time" },
  { value: "streams", label: "Plays" },
];

export function TopSortTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sort = searchParams.get(TOP_SORT_PARAM) === "streams" ? "streams" : "minutes";
  const hydratedFromStorage = useRef(false);

  function hrefFor(params: URLSearchParams) {
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function sortHref(next: TopSortBy) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "minutes") params.delete(TOP_SORT_PARAM);
    else params.set(TOP_SORT_PARAM, next);
    return hrefFor(params);
  }

  useEffect(() => {
    if (hydratedFromStorage.current) return;
    if (searchParams.has(TOP_SORT_PARAM)) {
      hydratedFromStorage.current = true;
      return;
    }
    const stored = getStoredTopSort();
    hydratedFromStorage.current = true;
    if (stored === "minutes") return;
    const params = new URLSearchParams(searchParams.toString());
    params.set(TOP_SORT_PARAM, stored);
    router.replace(hrefFor(params), { scroll: false });
  }, [router, searchParams, pathname]);

  return (
    <div
      role="tablist"
      aria-label="Rank by"
      className="flex border border-border bg-background p-0.5"
    >
      {options.map((o) => {
        const active = sort === o.value;
        return (
          <Link
            key={o.value}
            href={sortHref(o.value)}
            scroll={false}
            role="tab"
            aria-selected={active}
            onClick={() => setStoredTopSort(o.value)}
            className={cn(
              "inline-flex min-h-11 min-w-[4.5rem] flex-1 items-center justify-center px-3 py-2 text-xs font-medium sm:flex-none",
              active
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
