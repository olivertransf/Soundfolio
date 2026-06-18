"use client";

import { useOptionalStreams } from "@/components/streams-provider";

export function StreamsLoadBanner() {
  const streamsCtx = useOptionalStreams();
  if (!streamsCtx) return null;

  if (streamsCtx.error) {
    return (
      <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-center text-xs text-destructive">
        {streamsCtx.error}
      </div>
    );
  }

  if (!streamsCtx.loadingMore && !streamsCtx.hasMore) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 border-b border-border/50 bg-secondary/20 px-4 py-2 text-center text-xs text-muted-foreground">
      {streamsCtx.loadingMore ? (
        <span>
          Loading more history…{" "}
          <span className="font-medium text-foreground">
            {streamsCtx.streams.length.toLocaleString()} plays
          </span>
        </span>
      ) : (
        <>
          <span>
            Showing recent history ({streamsCtx.streams.length.toLocaleString()} plays). Load more for
            older stats.
          </span>
          <button
            type="button"
            className="rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-secondary/60"
            onClick={() => void streamsCtx.loadMore()}
          >
            Load more
          </button>
        </>
      )}
    </div>
  );
}
