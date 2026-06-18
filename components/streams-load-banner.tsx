"use client";

import { useOptionalStreams } from "@/components/streams-provider";

export function StreamsLoadBanner() {
  const streamsCtx = useOptionalStreams();
  if (!streamsCtx) return null;

  if (streamsCtx.error) {
    return (
      <div className="border-b border-destructive/30 bg-destructive/10">
        <div className="app-container flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm text-destructive">
          <p className="min-w-0 flex-1">{streamsCtx.error}</p>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-destructive/30 px-3 py-1 text-xs font-medium hover:bg-destructive/10"
            onClick={() => void streamsCtx.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!streamsCtx.loadingMore && !streamsCtx.hasMore) return null;

  return (
    <div className="border-b border-border/50 bg-secondary/15">
      <div className="app-container flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm text-muted-foreground">
        {streamsCtx.loadingMore ? (
          <p>
            Loading more history…{" "}
            <span className="font-medium text-foreground">
              {streamsCtx.streams.length.toLocaleString()} plays
            </span>
          </p>
        ) : (
          <>
            <p className="min-w-0">
              Showing recent history ({streamsCtx.streams.length.toLocaleString()} plays). Load more for older
              stats.
            </p>
            <button
              type="button"
              className="shrink-0 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/60"
              onClick={() => void streamsCtx.loadMore()}
            >
              Load more
            </button>
          </>
        )}
      </div>
    </div>
  );
}
