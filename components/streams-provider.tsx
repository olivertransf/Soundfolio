"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth-provider";
import { useUserStreams } from "@/hooks/use-user-streams";
import { useDemoStreams } from "@/hooks/use-demo-streams";
import type { StreamCacheMeta } from "@/lib/stream-idb-cache";
import type { Stream } from "@/lib/types/stream";

type StreamsContextValue = {
  streams: Stream[];
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  fullyLoaded: boolean;
  hasMore: boolean;
  cacheMeta: StreamCacheMeta | null;
  error: string | null;
  reload: () => Promise<void>;
  refreshHead: () => Promise<void>;
  loadMore: () => Promise<void>;
  setStreams: (streams: Stream[]) => void;
  clearCache: () => Promise<void>;
};

const StreamsContext = createContext<StreamsContextValue | null>(null);

export function StreamsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { streams, loading, loadingMore, refreshing, fullyLoaded, hasMore, cacheMeta, error, reload, refreshHead, loadMore, setStreams, clearCache } =
    useUserStreams();

  const value = useMemo(
    () => ({
      streams: user ? streams : [],
      loading: user ? loading : false,
      loadingMore: user ? loadingMore : false,
      refreshing: user ? refreshing : false,
      fullyLoaded: user ? fullyLoaded : true,
      hasMore: user ? hasMore : false,
      cacheMeta: user ? cacheMeta : null,
      error: user ? error : null,
      reload,
      refreshHead,
      loadMore,
      setStreams,
      clearCache,
    }),
    [user, streams, loading, loadingMore, refreshing, fullyLoaded, hasMore, cacheMeta, error, reload, refreshHead, loadMore, setStreams, clearCache]
  );

  return <StreamsContext.Provider value={value}>{children}</StreamsContext.Provider>;
}

export function DemoStreamsProvider({ children }: { children: ReactNode }) {
  const { streams, loading, error, reload, setStreams } = useDemoStreams();

  const value = useMemo(
    () => ({
      streams,
      loading,
      loadingMore: false,
      refreshing: false,
      fullyLoaded: true,
      hasMore: false,
      cacheMeta: null,
      error,
      reload,
      refreshHead: reload,
      loadMore: async () => {},
      setStreams,
      clearCache: async () => {},
    }),
    [streams, loading, error, reload, setStreams]
  );

  return <StreamsContext.Provider value={value}>{children}</StreamsContext.Provider>;
}

export function useStreams() {
  const ctx = useContext(StreamsContext);
  if (!ctx) {
    throw new Error("useStreams must be used within StreamsProvider");
  }
  return ctx;
}

export function useOptionalStreams() {
  return useContext(StreamsContext);
}
