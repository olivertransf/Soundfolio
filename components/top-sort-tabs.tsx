"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TOP_SORT_PARAM, type TopSortBy } from "@/lib/top-sort";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  getStoredTopSort,
  setStoredTopSort,
} from "@/lib/stats-session-preferences";

const options: { value: TopSortBy; label: string }[] = [
  { value: "minutes", label: "Listening time" },
  { value: "streams", label: "Play count" },
];

export function TopSortTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sort = searchParams.get(TOP_SORT_PARAM) === "streams" ? "streams" : "minutes";
  const [open, setOpen] = useState(false);
  const hydratedFromStorage = useRef(false);

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
    router.replace(`?${params.toString()}`);
  }, [router, searchParams]);

  function apply(next: TopSortBy) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "minutes") params.delete(TOP_SORT_PARAM);
    else params.set(TOP_SORT_PARAM, next);
    setStoredTopSort(next);
    router.push(`?${params.toString()}`);
    setOpen(false);
  }

  const label = options.find((o) => o.value === sort)?.label ?? "Listening time";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        className={cn(
          "box-border inline-flex min-h-10 w-full min-w-0 max-w-full items-center justify-between gap-2 rounded-xl border border-border/60 bg-secondary/25 px-3 py-2 text-left text-sm font-medium leading-snug text-foreground shadow-none outline-none transition-colors hover:bg-secondary/40 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 sm:w-auto sm:min-w-[11rem]"
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(100vw-2rem,14rem)] min-w-[11rem] p-1"
        align="start"
      >
        <div className="flex flex-col p-0.5">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => apply(o.value)}
              className={cn(
                "rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-secondary/80",
                sort === o.value && "bg-secondary font-medium text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
