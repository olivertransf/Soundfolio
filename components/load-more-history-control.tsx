"use client";

import { useStreams } from "@/components/streams-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LoadMoreHistoryControl({ className }: { className?: string }) {
  const { streams, hasMore, fullyLoaded, loadingMore, loadMore } = useStreams();

  if (!hasMore && !loadingMore) return null;
  if (fullyLoaded && !loadingMore) return null;

  if (loadingMore) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Loading older plays…{" "}
        <span className="font-medium text-foreground">{streams.length.toLocaleString()} loaded</span>
      </p>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("h-8 shrink-0 text-xs", className)}
      onClick={() => void loadMore()}
    >
      Load more
    </Button>
  );
}
