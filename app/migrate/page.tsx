"use client";

import { useCallback, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { writeUserStreams } from "@/lib/firestore/streams";
import type { StreamInput } from "@/lib/types/stream";

type ChunkResponse = {
  total: number;
  offset: number;
  count: number;
  hasMore: boolean;
  streams: Array<Omit<StreamInput, "playedAt"> & { playedAt: string }>;
  error?: string;
};

export default function MigratePage() {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState("Ready to import legacy MongoDB streams into your Firestore account.");
  const [running, setRunning] = useState(false);
  const [written, setWritten] = useState(0);

  const runImport = useCallback(async () => {
    const auth = getFirebaseAuth();
    const current = auth.currentUser;
    if (!current) return;

    setRunning(true);
    setWritten(0);
    let offset = 0;
    let totalWritten = 0;

    try {
      for (let page = 0; page < 500; page++) {
        const token = await current.getIdToken(true);
        const response = await fetch(`/api/migrate/chunk?offset=${offset}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await response.json()) as ChunkResponse;
        if (!response.ok) {
          throw new Error(data.error ?? "Import chunk failed.");
        }

        const incoming = data.streams.map((stream) => ({
          ...stream,
          playedAt: new Date(stream.playedAt),
        }));
        if (incoming.length === 0) break;

        const batchWritten = await writeUserStreams(current.uid, incoming, true);
        totalWritten += batchWritten;
        setWritten(totalWritten);
        setStatus(`Imported ${totalWritten} / ${data.total} streams…`);

        if (!data.hasMore) break;
        offset += data.count;
      }

      setStatus(`Done. Wrote ${totalWritten} streams to Firestore.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setRunning(false);
    }
  }, []);

  if (authLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6 text-center">
        <h1 className="text-xl font-semibold">Import listening history</h1>
        <p className="text-sm text-muted-foreground">Sign in with Google first, then return here.</p>
        <a href="/auth?next=/migrate" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Sign in
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-border/60 bg-card/70 p-6">
      <h1 className="text-xl font-semibold">Import listening history</h1>
      <p className="text-sm text-muted-foreground">
        One-time import from MongoDB into <span className="font-mono text-foreground">users/{user.uid}/streams</span>.
      </p>
      <p className="text-sm text-foreground">{status}</p>
      {written > 0 ? <p className="text-sm tabular-nums text-muted-foreground">{written.toLocaleString()} written</p> : null}
      <button
        type="button"
        disabled={running}
        onClick={() => void runImport()}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {running ? "Importing…" : "Start import"}
      </button>
    </div>
  );
}
