import { RecentPlaysList } from "@/components/recent-plays-list";
import { ContentPanel } from "@/components/page-shell";
import type { Stream } from "@/lib/types/stream";
import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function RecentPlaysPanel({
  title = "Recent",
  streams,
  compact = false,
  limit,
  action,
  className,
}: {
  title?: string;
  description?: string;
  streams: Stream[];
  compact?: boolean;
  limit?: number;
  action?: ReactNode;
  className?: string;
}) {
  const visible = typeof limit === "number" ? streams.slice(0, limit) : streams;
  return (
    <div className={cn("flex min-h-0 flex-col border border-border bg-card", className)}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        {action}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        <RecentPlaysList
          compact={compact}
          linkable
          groupByDay
          initialStreams={visible.map((stream) => ({
            id: stream.id,
            trackName: stream.trackName,
            artistName: stream.artistName,
            albumName: stream.albumName,
            albumArt: stream.albumArt,
            playedAt: stream.playedAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}

export function RecentPlaysSeeAllLink({ href }: { href: string }) {
  return (
    <Link href={href} className="text-xs font-medium text-primary hover:underline">
      All
    </Link>
  );
}

/** @deprecated ContentPanel wrapper kept for callers that need a plain panel. */
export function RecentPlaysBoxed({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <ContentPanel className={className}>{children}</ContentPanel>;
}
