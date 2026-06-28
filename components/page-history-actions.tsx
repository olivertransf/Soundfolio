"use client";

import { LiveSyncStatus } from "@/components/live-sync-status";
import { cn } from "@/lib/utils";

export function PageHistoryActions({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-2", className)}>
      <LiveSyncStatus />
    </div>
  );
}
