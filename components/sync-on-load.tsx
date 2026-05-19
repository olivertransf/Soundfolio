"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * On each full document load: Last.fm sync + one batch each of album-art and artist-image backfills.
 * Batches are capped per request; large libraries need repeated refreshes, Import page backfill, or CLI scripts.
 * See README: "Backfill: album and artist images".
 */
export function SyncOnLoad() {
  const didRun = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const run = async () => {
      const jobs = await Promise.allSettled([
        fetch("/api/sync-lastfm", { method: "POST" }).then((r) => r.json()),
        fetch("/api/backfill-artists", { method: "POST" }).then((r) => r.json()),
        fetch("/api/backfill-art", { method: "POST" }).then((r) => r.json()),
      ]);

      const changed = jobs.some((job) => {
        if (job.status !== "fulfilled") return false;
        const result = job.value as { synced?: number; updated?: number };
        return (result.synced ?? 0) > 0 || (result.updated ?? 0) > 0;
      });

      if (changed) router.refresh();
    };

    void run();
  }, [router]);

  return null;
}
