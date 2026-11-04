"use client";

import { useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { monthLabel } from "@/lib/archive-analytics";

export function ArchivePeriodPicker({
  month,
  availableMonths,
  onChange,
}: {
  month: string;
  availableMonths: Map<string, { rows: unknown[] }>;
  onChange: (month: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  const [choosingYear, setChoosingYear] = useState(false);
  const years = [
    ...new Set(
      [...availableMonths.keys()]
        .map((m) => Number(m.slice(0, 4)))
        .concat(year),
    ),
  ].sort((a, b) => b - a);
  function choose(value: string) {
    onChange(value);
    setOpen(false);
  }
  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) {
          setYear(Number(month.slice(0, 4)));
          setChoosingYear(false);
        }
      }}
    >
      <PopoverTrigger
        aria-label={`Choose listening month, ${monthLabel(month)}`}
        className="archive-period-trigger"
      >
        <CalendarDays size={16} aria-hidden="true" />
        <span>{monthLabel(month)}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="archive-period-picker w-[min(calc(100vw-2rem),19rem)] gap-3 p-3"
      >
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="archive-picker-arrow"
            aria-label="Previous year"
            onClick={() => setYear((y) => y - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="archive-picker-year"
            aria-label={
              choosingYear ? "Back to months" : `Choose year, ${year}`
            }
            onClick={() => setChoosingYear((v) => !v)}
          >
            {year}
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="archive-picker-arrow"
            aria-label="Next year"
            onClick={() => setYear((y) => y + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        {choosingYear ? (
          <div
            className="archive-picker-grid max-h-64 overflow-y-auto"
            aria-label="Years with listening history"
          >
            {years.map((y) => (
              <button
                type="button"
                key={y}
                aria-pressed={year === y}
                onClick={() => {
                  setYear(y);
                  setChoosingYear(false);
                }}
              >
                {y}
              </button>
            ))}
          </div>
        ) : (
          <div className="archive-picker-grid" aria-label={`Months in ${year}`}>
            {Array.from(
              { length: 12 },
              (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`,
            ).map((m) => {
              const period = availableMonths.get(m);
              return (
                <button
                  type="button"
                  key={m}
                  aria-pressed={month === m}
                  aria-label={`${monthLabel(m)}, ${period ? `${period.rows.length} plays` : "no recorded plays"}`}
                  onClick={() => choose(m)}
                >
                  <span>{monthLabel(m).split(" ")[0].slice(0, 3)}</span>
                  <span
                    aria-hidden="true"
                    className={
                      period ? "archive-picker-dot" : "archive-picker-dot empty"
                    }
                  />
                </button>
              );
            })}
          </div>
        )}
        <p className="border-t border-border pt-2 text-[11px] text-muted-foreground">
          {choosingYear
            ? "Choose a year to explore its months."
            : "A dot marks months with recorded listening."}
        </p>
      </PopoverContent>
    </Popover>
  );
}
