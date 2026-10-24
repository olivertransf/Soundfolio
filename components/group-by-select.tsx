"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type GroupByMode = "days" | "weeks" | "months";

const labels: Record<GroupByMode, string> = {
  days: "Daily",
  weeks: "Weekly",
  months: "Monthly",
};

const order: GroupByMode[] = ["days", "weeks", "months"];

export function GroupBySelect({
  value,
  onValueChange,
}: {
  value: GroupByMode;
  onValueChange: (v: GroupByMode) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        className={cn(
          "box-border inline-flex min-h-10 w-full min-w-0 max-w-full items-center justify-between gap-2 rounded-xl border border-border/60 bg-secondary/25 px-3 py-2 text-left text-sm font-medium leading-snug text-foreground shadow-none outline-none transition-colors hover:bg-secondary/40 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 sm:w-auto sm:min-w-[9.5rem]"
        )}
      >
        <span className="truncate">{labels[value]}</span>
        <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(calc(100vw-2rem),14rem)] min-w-[9.5rem] p-1"
        align="start"
      >
        <div className="flex flex-col p-0.5">
          {order.map((m) => (
            <button
              key={m}
              type="button"
              className={cn(
                "rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                value === m
                  ? "bg-primary/15 font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              onClick={() => {
                onValueChange(m);
                setOpen(false);
              }}
            >
              {labels[m]}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
