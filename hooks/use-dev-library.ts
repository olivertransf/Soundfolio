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
  loaded?: number;
  total?: number | null;
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

export type LibraryTransfer = {
  loaded: number;
  total: number | null;
};

async function fetchDevLibraryPage(
  url: string,
  onProgress: (loaded: number, total: number | null) => void
): Promise<DevLibraryPage> {
  const response = await fetch(url);
  if (!response.ok) {
    const page = (await response.json()) as DevLibraryPage;
    throw new Error(page.error ?? "Could not load the dev library.");
  }
  if (!response.body) return (await response.json()) as DevLibraryPage;

  const totalHeader = Number(response.headers.get("Content-Length"));
  const total = Number.isFinite(totalHeader) && totalHeader > 0 ? totalHeader : null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  let lastPaint = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    received += value.byteLength;
    const now = Date.now();
    if (now - lastPaint > 80 || (total !== null && received >= total)) {
      lastPaint = now;
      onProgress(received, total);
    }
  }
  onProgress(received, total ?? received);
  const text = await new Blob(chunks as BlobPart[]).text();
  return JSON.parse(text) as DevLibraryPage;
}

export function useDevLibrary(enabled: boolean) {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [request, setRequest] = useState<"idle" | "loading" | "partial" | "ready" | "error">("idle");
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transfer, setTransfer] = useState<LibraryTransfer | null>(null);
  const loading = enabled && (request === "idle" || request === "loading");
  const fullyLoaded = !enabled || request === "ready";

  const reload = useCallback(async () => {
    if (!enabled) return;
    setRequest("loading");
    setLoadingMore(false);
    setError(null);
    setTransfer({ loaded: 0, total: null });
    const all: Stream[] = [];
    let offset: number | null = 0;
    try {
      do {
        const url = offset ? `/api/dev/library?offset=${offset}` : "/api/dev/library";
        const page = await fetchDevLibraryPage(url, (loaded, total) => {
          setTransfer({ loaded, total });
        });
        if (page.streams.length > 0) {
          all.push(...page.streams.map(toStream));
          setStreams(all.slice());
        }
        setLoadedCount(page.loaded ?? all.length);
        if (typeof page.total === "number") setTotalCount(page.total);
        const stalled = Boolean(page.partial) && page.streams.length === 0;
        offset = page.nextOffset;
        setRequest(offset === null ? "ready" : "partial");
        setLoadingMore(offset !== null);
        if (stalled) {
          await new Promise((resolve) => setTimeout(resolve, 700));
        }
      } while (offset !== null);
      setRequest("ready");
      setLoadingMore(false);
      setTransfer(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the dev library.");
      setRequest("error");
      setLoadingMore(false);
      setTransfer(null);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setStreams([]);
      setRequest("idle");
      setLoadingMore(false);
      setLoadedCount(0);
      setTotalCount(null);
      setError(null);
      setTransfer(null);
      return;
    }
    void reload();
  }, [enabled, reload]);

  return useMemo(
    () => ({
      streams,
      loading,
      loadingMore,
      loadedCount,
      totalCount,
      refreshing: false,
      fullyLoaded,
      hasMore: loadingMore,
      cacheMeta: null,
      error,
      transfer,
      reload,
      refreshHead: reload,
      loadMore: async () => {},
      setStreams,
      clearCache: async () => {},
    }),
    [streams, loading, loadingMore, loadedCount, totalCount, fullyLoaded, error, transfer, reload]
  );
}
