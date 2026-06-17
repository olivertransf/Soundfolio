"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { fetchUserStreams } from "@/lib/firestore/streams";
import type { Stream } from "@/lib/types/stream";

export function useUserStreams() {
  const { user, loading: authLoading } = useAuth();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) {
      setStreams([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setStreams(await fetchUserStreams(user.uid));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load listening history.");
      setStreams([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void reload();
  }, [authLoading, reload]);

  return useMemo(
    () => ({ streams, loading: authLoading || loading, error, reload, setStreams }),
    [streams, authLoading, loading, error, reload]
  );
}
