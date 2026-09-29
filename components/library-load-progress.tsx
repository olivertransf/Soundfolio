"use client";

import { useStreams } from "@/components/streams-provider";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LibraryLoadProgress() {
  const { streams, loading, loadingMore, fullyLoaded, loadedCount, totalCount, transfer, error } =
    useStreams();
  const pending = !fullyLoaded && !error && (loading || loadingMore || transfer !== null);
  if (!pending) return null;

  const loaded = loadedCount || streams.length;
  const playPercent =
    totalCount && totalCount > 0 ? Math.min(100, Math.round((loaded / totalCount) * 100)) : null;
  const bytePercent =
    transfer?.total && transfer.total > 0
      ? Math.min(100, Math.round((transfer.loaded / transfer.total) * 100))
      : null;
  const percent = loaded > 0 ? playPercent : (bytePercent ?? playPercent);
  const countLabel =
    loaded > 0 && totalCount
      ? `${loaded.toLocaleString()} / ${totalCount.toLocaleString()} plays`
      : loaded > 0
        ? `${loaded.toLocaleString()} plays`
        : transfer && transfer.loaded > 0
          ? transfer.total
            ? `${formatBytes(transfer.loaded)} / ${formatBytes(transfer.total)}`
            : formatBytes(transfer.loaded)
          : "Starting";

  return (
    <div className="sticky top-[calc(3.25rem+env(safe-area-inset-top,0px))] z-40 -mt-1 mb-3 space-y-1.5 bg-background/95 py-2 backdrop-blur-sm">
      <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
        <span>Loading history</span>
        <span className="tabular-nums">
          {countLabel}
          {percent !== null ? ` · ${percent}%` : ""}
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={percent ?? undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Library load progress"
      >
        {percent === null ? (
          <div className="h-full w-1/3 animate-pulse bg-primary" />
        ) : (
          <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${Math.max(percent, 2)}%` }} />
        )}
      </div>
    </div>
  );
}
