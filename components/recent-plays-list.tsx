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
      <div className="grid gap-x-4 gap-y-0 divide-y divide-border/30 md:grid-cols-2 xl:grid-cols-3 xl:divide-y-0">
        {streams.map((stream) => (
          <RowWrapper key={stream.id} stream={stream}>
            <div className="group flex items-center gap-2.5 px-1 py-2 sm:px-2">
              <AlbumArt
                src={stream.albumArt}
                alt={stream.albumName}
                width={36}
                height={36}
                className="size-9 shrink-0 rounded-md ring-1 ring-border/35"
              />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="truncate text-sm font-medium leading-tight">{stream.trackName}</p>
                  {stream.isNowPlaying ? (
                    <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      Now
                    </span>
                  ) : null}
                </div>
                <p className="truncate text-xs leading-tight text-muted-foreground">
                  {stream.artistName}
                  <span className="hidden sm:inline"> · {stream.albumName}</span>
                </p>
              </div>
              <div className="shrink-0 text-right">
                {!stream.isNowPlaying ? (
                  <p className="text-[11px] tabular-nums leading-tight text-muted-foreground sm:text-xs">
                    <LocalDateTime date={stream.playedAt} pattern="MMM d" />
                    <span className="hidden sm:inline">
                      {" "}
                      · <LocalDateTime date={stream.playedAt} pattern="h:mm a" />
                    </span>
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
