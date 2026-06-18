"use client";

import Link from "next/link";
import { AlbumArt } from "@/components/album-art";
import { LocalDateTime } from "@/components/local-datetime";
import { trackPath } from "@/lib/entity-paths";
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
  linkable = false,
}: {
  initialStreams: RecentStream[];
  compact?: boolean;
  linkable?: boolean;
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

  const RowWrapper = ({
    stream,
    children,
  }: {
    stream: RecentStream;
    children: React.ReactNode;
  }) => {
    if (!linkable) return <>{children}</>;
    return (
      <Link
        href={trackPath(stream.artistName, stream.trackName)}
        className="block transition-colors hover:bg-muted/25"
      >
        {children}
      </Link>
    );
  };

  if (compact) {
    return (
      <ul className="divide-y divide-border/25">
        {streams.map((stream) => (
          <li key={stream.id}>
            <RowWrapper stream={stream}>
              <div className="flex items-center gap-3 rounded-lg px-2 py-2">
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
            </RowWrapper>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div>
      <div className="hidden border-b border-border/30 px-2 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-[minmax(0,1fr)_10rem]">
        <span>Track</span>
        <span className="text-right">Played</span>
      </div>
      <div className="divide-y divide-border/30">
        {streams.map((stream) => (
          <RowWrapper key={stream.id} stream={stream}>
            <div className="group grid items-center gap-3 px-1 py-2.5 sm:px-2 md:grid-cols-[minmax(0,1fr)_10rem]">
              <div className="flex min-w-0 items-center gap-3">
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
              </div>
              <div className="shrink-0 pl-14 text-left md:pl-0 md:text-right">
                {!stream.isNowPlaying ? (
                  <p className="text-xs tabular-nums text-muted-foreground">
                    <LocalDateTime date={stream.playedAt} pattern="MMM d, yyyy · h:mm a" />
                  </p>
                ) : (
                  <p className="text-xs font-medium text-primary">Playing</p>
                )}
              </div>
            </div>
          </RowWrapper>
        ))}
      </div>
    </div>
  );
}
