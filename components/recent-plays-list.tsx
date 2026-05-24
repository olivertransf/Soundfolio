"use client";

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
  compact = false,
}: {
  initialStreams: RecentStream[];
  compact?: boolean;
}) {
  const streams = initialStreams;

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
