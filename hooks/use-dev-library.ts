"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Stream } from "@/lib/types/stream";

type DevStreamPayload = {
  id: string;
  trackId: string;
  trackName: string;
  artistName: string;
  artistArt: string | null;
  albumName: string;
  albumArt: string | null;
  durationMs: number;
  playedAt: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
};

type DevLibraryPage = {
  streams: DevStreamPayload[];
  nextOffset: number | null;
  error?: string;
};

function toStream(row: DevStreamPayload): Stream {
  return {
    ...row,
    playedAt: new Date(row.playedAt),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

export function useDevLibrary(enabled: boolean) {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fullyLoaded, setFullyLoaded] = useState(!enabled);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setLoadingMore(false);
    setFullyLoaded(false);
    setError(null);
    const all: Stream[] = [];
    let offset: number | null = 0;
    try {
      do {
        const url = offset ? `/api/dev/library?offset=${offset}` : "/api/dev/library";
        const response = await fetch(url);
        const page = (await response.json()) as DevLibraryPage;
        if (!response.ok) {
          throw new Error(page.error ?? "Could not load the dev library.");
        }
        all.push(...page.streams.map(toStream));
        setStreams([...all]);
        offset = page.nextOffset;
        setLoading(false);
        setLoadingMore(offset !== null);
      } while (offset !== null);
      setFullyLoaded(true);
      setLoadingMore(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the dev library.");
      setLoading(false);
      setLoadingMore(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setStreams([]);
      setLoading(false);
      setLoadingMore(false);
      setFullyLoaded(true);
      setError(null);
      return;
    }
    void reload();
  }, [enabled, reload]);

  return useMemo(
    () => ({
      streams,
      loading,
      loadingMore,
      refreshing: false,
      fullyLoaded,
      hasMore: loadingMore,
      cacheMeta: null,
      error,
      reload,
      refreshHead: reload,
      loadMore: async () => {},
      setStreams,
      clearCache: async () => {},
    }),
    [streams, loading, loadingMore, fullyLoaded, error, reload]
  );
}
