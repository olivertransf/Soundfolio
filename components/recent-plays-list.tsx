"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlbumArt } from "@/components/album-art";
import { LocalDateTime } from "@/components/local-datetime";
import { cn } from "@/lib/utils";

type RecentStream = {
  id: string;
  trackName: string;
  artistName: string;
  albumName: string;
  albumArt: string | null;
  playedAt: string;
  isNowPlaying?: boolean;
};

export function RecentPlaysList({
  initialStreams,
  limit = 100,
  compact = false,
  pollMs = 20_000,
}: {
  initialStreams: RecentStream[];
  limit?: number;
  compact?: boolean;
  pollMs?: number;
}) {
  const router = useRouter();
  const [streams, setStreams] = useState(initialStreams);
  const latestKeyRef = useRef(getLatestKey(initialStreams));

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        await fetch("/api/sync-lastfm", {
          method: "POST",
          credentials: "same-origin",
        });
      } catch {
        // Sync is best-effort; recent API still returns stored plays.
      }

      const response = await fetch(`/api/stats/recent?limit=${limit}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok || cancelled) return;

      const data = (await response.json()) as { streams?: RecentStream[] };
      const nextStreams = data.streams ?? [];
      const nextKey = getLatestKey(nextStreams);

      if (cancelled) return;
      setStreams(nextStreams);

      if (nextKey && nextKey !== latestKeyRef.current) {
        latestKeyRef.current = nextKey;
        router.refresh();
      }
    }

    void refresh();
    const interval = window.setInterval(refresh, pollMs);
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [limit, pollMs, router]);

  if (streams.length === 0) {
    return (
      <p
        className={cn(
          "text-center text-sm text-muted-foreground",
          compact ? "px-2 py-6" : "py-10"
        )}
      >
        No plays yet. Import your Spotify data to get started.
      </p>
    );
  }

  if (compact) {
    return (
      <ul className="divide-y divide-border/25">
        {streams.map((stream) => (
          <li key={stream.id}>
            <div className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/25">
              <AlbumArt
                src={stream.albumArt}
                alt={stream.albumName}
                width={32}
                height={32}
                className="size-8 shrink-0 rounded-md ring-1 ring-border/25"
              />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-sm font-medium leading-snug">{stream.trackName}</p>
                  {stream.isNowPlaying ? (
                    <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      Now
                    </span>
                  ) : null}
                </div>
                <p className="truncate text-xs leading-snug text-muted-foreground">
                  {stream.artistName}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {stream.isNowPlaying ? (
                  <p className="text-xs font-medium text-primary">Playing</p>
                ) : (
                  <>
                    <p className="text-xs tabular-nums leading-none text-muted-foreground">
                      <LocalDateTime date={stream.playedAt} pattern="MMM d" />
                    </p>
                    <p className="text-xs tabular-nums leading-none text-muted-foreground">
                      <LocalDateTime date={stream.playedAt} pattern="h:mm a" />
                    </p>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="divide-y divide-border/30">
      {streams.map((stream) => (
        <div
          key={stream.id}
          className="group flex items-center gap-3 px-1 py-2.5 transition-colors hover:bg-secondary/25 sm:px-2"
        >
          <AlbumArt
            src={stream.albumArt}
            alt={stream.albumName}
            width={44}
            height={44}
            className="size-11 shrink-0 rounded-lg ring-1 ring-border/35"
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-medium">{stream.trackName}</p>
              {stream.isNowPlaying ? (
                <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Now
                </span>
              ) : null}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {stream.artistName} · {stream.albumName}
            </p>
          </div>
          <div className="shrink-0 text-right">
            {stream.isNowPlaying ? (
              <p className="text-xs font-medium text-primary">Playing</p>
            ) : (
              <>
                <p className="text-xs tabular-nums text-muted-foreground">
                  <LocalDateTime date={stream.playedAt} pattern="MMM d" />
                </p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  <LocalDateTime date={stream.playedAt} pattern="h:mm a" />
                </p>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function getLatestKey(streams: RecentStream[]) {
  const first = streams[0];
  if (!first) return "";
  return `${first.id}:${first.playedAt}:${first.isNowPlaying ? "1" : "0"}`;
}
