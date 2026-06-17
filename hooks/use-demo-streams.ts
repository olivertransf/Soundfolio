"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchDemoStreams } from "@/lib/firestore/streams";
import { getDemoStreams, type DemoStreamRow } from "@/lib/demo-seed";
import type { Stream } from "@/lib/types/stream";

function demoRowsToStreams(rows: DemoStreamRow[]): Stream[] {
  return rows.map((row) => ({
    id: row.id,
    trackId: row.trackId,
    trackName: row.trackName,
    artistName: row.artistName,
    artistArt: row.artistArt,
    albumName: row.albumName,
    albumArt: row.albumArt,
    durationMs: row.durationMs,
    playedAt: row.playedAt,
    isDemo: true,
    createdAt: row.playedAt,
    updatedAt: row.playedAt,
  }));
}

export function useDemoStreams() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const remote = await fetchDemoStreams();
      if (remote.length > 0) {
        setStreams(remote);
        return;
      }
      setStreams(demoRowsToStreams(getDemoStreams()));
    } catch (err) {
      setStreams(demoRowsToStreams(getDemoStreams()));
      setError(err instanceof Error ? err.message : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return useMemo(
    () => ({ streams, loading, error, reload, setStreams }),
    [streams, loading, error, reload]
  );
}
