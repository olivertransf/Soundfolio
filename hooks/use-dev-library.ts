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
  partial?: boolean;
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
  const [request, setRequest] = useState<"idle" | "loading" | "partial" | "ready" | "error">("idle");
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loading = enabled && (request === "idle" || request === "loading");
  const fullyLoaded = !enabled || request === "ready";

  const reload = useCallback(async () => {
    if (!enabled) return;
    setRequest("loading");
    setLoadingMore(false);
    setError(null);
    const all: Stream[] = [];
    let offset: number | null = 0;
    let pause = 8000;
    try {
      do {
        const url = offset ? `/api/dev/library?offset=${offset}` : "/api/dev/library";
        const response = await fetch(url);
        const page = (await response.json()) as DevLibraryPage;
        if (!response.ok) {
          throw new Error(page.error ?? "Could not load the dev library.");
        }
        if (page.streams.length > 0) {
          all.push(...page.streams.map(toStream));
          setStreams([...all]);
        }
        offset = page.partial ? (page.nextOffset ?? offset) : page.nextOffset;
        setRequest(offset === null ? "ready" : "partial");
        setLoadingMore(offset !== null);
        if (page.partial) {
          await new Promise((resolve) => setTimeout(resolve, pause));
          pause = Math.min(pause * 2, 30000);
        }
      } while (offset !== null);
      setRequest("ready");
      setLoadingMore(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the dev library.");
      setRequest("error");
      setLoadingMore(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setStreams([]);
      setRequest("idle");
      setLoadingMore(false);
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
