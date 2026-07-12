"use client";

import Link from "next/link";
import { format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";
import { AlbumArt } from "@/components/album-art";
import { trackPath } from "@/lib/entity-paths";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

type RecentStream = {
  id: string;
  trackName: string;
  artistName: string;
  albumName: string;
  albumArt: string | null;
  playedAt: string;
  isNowPlaying?: boolean;
};

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEE, MMM d");
}

function PlayTime({ iso, isNowPlaying }: { iso: string; isNowPlaying?: boolean }) {
  const [relative, setRelative] = useState(false);
  const [text, setText] = useState(() => format(new Date(iso), "h:mm a"));

  useEffect(() => {
    const update = () => {
      const useRelative =
        document.documentElement.dataset.timeDisplay === "relative";
      setRelative(useRelative);
      const d = new Date(iso);
      setText(
        useRelative
          ? formatDistanceToNowStrict(d, { addSuffix: true })
          : format(d, "h:mm a")
      );
    };
    update();
    window.addEventListener("soundfolio:prefs", update);
    return () => window.removeEventListener("soundfolio:prefs", update);
  }, [iso]);

  if (isNowPlaying) {
    return <span className="text-xs font-medium text-primary">Now</span>;
  }

  return (
    <time
      dateTime={iso}
      className={cn(
        "shrink-0 text-right text-[11px] tabular-nums text-muted-foreground",
        relative && "max-w-[5.5rem] truncate"
      )}
      title={format(new Date(iso), "PPpp")}
    >
      {text}
    </time>
  );
}

export function RecentPlaysList({
  initialStreams,
  compact = false,
  linkable = false,
  groupByDay = true,
}: {
  initialStreams: RecentStream[];
  compact?: boolean;
  linkable?: boolean;
  groupByDay?: boolean;
}) {
  const streams = initialStreams;

  if (streams.length === 0) {
    return (
      <p className={cn("text-center text-sm text-muted-foreground", compact ? "px-2 py-6" : "py-10")}>
        No plays yet.
      </p>
    );
  }

  const groups: { key: string; label: string; items: RecentStream[] }[] = [];
  if (groupByDay) {
    for (const stream of streams) {
      const key = dayKey(stream.playedAt);
      const last = groups[groups.length - 1];
      if (last?.key === key) last.items.push(stream);
      else groups.push({ key, label: dayLabel(stream.playedAt), items: [stream] });
    }
  } else {
    groups.push({ key: "all", label: "", items: streams });
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <section key={group.key} className="min-w-0">
          {group.label ? (
            <h3 className="sticky top-0 z-[1] border-b border-border bg-card px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </h3>
          ) : null}
          <ul>
            {group.items.map((stream) => {
              const row = (
                <div
                  data-row
                  className={cn(
                    "flex items-center gap-2.5 px-2 transition-colors hover:bg-secondary/50",
                    compact ? "py-1.5" : "py-2"
                  )}
                >
                  <AlbumArt
                    src={stream.albumArt}
                    alt={stream.albumName}
                    width={compact ? 32 : 40}
                    height={compact ? 32 : 40}
                    className={cn(
                      "shrink-0 rounded",
                      compact ? "size-8" : "size-10"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">{stream.trackName}</p>
                    <p className="truncate text-xs leading-tight text-muted-foreground">
                      {stream.artistName}
                    </p>
                  </div>
                  <PlayTime iso={stream.playedAt} isNowPlaying={stream.isNowPlaying} />
                </div>
              );

              return (
                <li key={stream.id}>
                  {linkable ? (
                    <Link
                      href={trackPath(stream.artistName, stream.trackName)}
                      className="block"
                    >
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
