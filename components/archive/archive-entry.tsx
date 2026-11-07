"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStreams } from "@/components/streams-provider";
import { buildArchive, monthLabel } from "@/lib/archive-analytics";
import { resolveStatsTimeZone } from "@/lib/stats-timezone";

export function ArchiveEntry() {
  const { streams } = useStreams();
  const demo = usePathname().startsWith("/demo");
  const tz = resolveStatsTimeZone();
  const archive = useMemo(() => buildArchive(streams, tz), [streams, tz]);
  const latest = archive.all.days.at(-1)?.slice(0, 7);
  if (!latest) return null;
  const query = new URLSearchParams({ month: latest, tz });

  return (
    <Link
      href={`${demo ? "/demo" : ""}/time-machine?${query}`}
      className="flex min-h-14 flex-wrap items-center justify-between gap-2 border border-border bg-card px-4 py-3 transition-colors hover:bg-secondary/50 focus-visible:outline-2 focus-visible:outline-primary"
    >
      <span className="text-sm font-semibold">Time Machine</span>
      <span className="text-xs text-muted-foreground">Explore {monthLabel(latest)} →</span>
    </Link>
  );
}
