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
import type { Stream } from "@/lib/types/stream";

type StreamsContextValue = {
  streams: Stream[];
  loading: boolean;
  loadingMore: boolean;
  fullyLoaded: boolean;
  hasMore: boolean;
  error: string | null;
  reload: () => Promise<void>;
  loadMore: () => Promise<void>;
  setStreams: (streams: Stream[]) => void;
};

const StreamsContext = createContext<StreamsContextValue | null>(null);

export function StreamsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { streams, loading, loadingMore, fullyLoaded, hasMore, error, reload, loadMore, setStreams } =
    useUserStreams();

  const value = useMemo(
    () => ({
      streams: user ? streams : [],
      loading: user ? loading : false,
      loadingMore: user ? loadingMore : false,
      fullyLoaded: user ? fullyLoaded : true,
      hasMore: user ? hasMore : false,
      error: user ? error : null,
      reload,
      loadMore,
      setStreams,
    }),
    [user, streams, loading, loadingMore, fullyLoaded, hasMore, error, reload, loadMore, setStreams]
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
      fullyLoaded: true,
      hasMore: false,
      error,
      reload,
      loadMore: async () => {},
      setStreams,
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
