"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth-provider";
import { useDevLibrary } from "@/hooks/use-dev-library";
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
  const { user, loading: authLoading } = useAuth();
  const signedIn = useUserStreams();
  const devEnabled = process.env.NODE_ENV === "development" && !authLoading && !user;
  const devLibrary = useDevLibrary(devEnabled);
  const active = user ? signedIn : devEnabled ? devLibrary : null;

  const value = useMemo(
    () => ({
      streams: active?.streams ?? [],
      loading: authLoading || (active ? active.loading : false),
      loadingMore: active?.loadingMore ?? false,
      refreshing: active?.refreshing ?? false,
      fullyLoaded: active?.fullyLoaded ?? !authLoading,
      hasMore: active?.hasMore ?? false,
      cacheMeta: active?.cacheMeta ?? null,
      error: active?.error ?? null,
      reload: active?.reload ?? (async () => {}),
      refreshHead: active?.refreshHead ?? (async () => {}),
      loadMore: active?.loadMore ?? (async () => {}),
      setStreams: active?.setStreams ?? (() => {}),
      clearCache: active?.clearCache ?? (async () => {}),
    }),
    [active, authLoading]
  );

  return <StreamsContext.Provider value={value}>{children}</StreamsContext.Provider>;
}

function DevLibraryProvider({ children }: { children: ReactNode }) {
  const data = useDevLibrary(true);
  return <StreamsContext.Provider value={data}>{children}</StreamsContext.Provider>;
}

export function DemoStreamsProvider({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "development") {
    return <DevLibraryProvider>{children}</DevLibraryProvider>;
  }

  return <SyntheticDemoStreamsProvider>{children}</SyntheticDemoStreamsProvider>;
}

function SyntheticDemoStreamsProvider({ children }: { children: ReactNode }) {
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
