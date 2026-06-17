"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth-provider";
import { useUserStreams } from "@/hooks/use-user-streams";
import type { Stream } from "@/lib/types/stream";

type StreamsContextValue = {
  streams: Stream[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  setStreams: (streams: Stream[]) => void;
};

const StreamsContext = createContext<StreamsContextValue | null>(null);

export function StreamsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { streams, loading, error, reload, setStreams } = useUserStreams();

  const value = useMemo(
    () => ({
      streams: user ? streams : [],
      loading: user ? loading : false,
      error: user ? error : null,
      reload,
      setStreams,
    }),
    [user, streams, loading, error, reload, setStreams]
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
