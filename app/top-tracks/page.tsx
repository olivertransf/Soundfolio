"use client";

import { Suspense, useMemo } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { TopListToolbar } from "@/components/top-list-toolbar";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { RankedStreamRow } from "@/components/ranked-stream-row";
import { useStreams } from "@/components/streams-provider";
import {
  computeTopTracks,
  parseTimeRange,
  parseTopSortBy,
  topSortLabel,
} from "@/lib/stats-compute";
import { VIEWER_TIMEZONE_PARAM } from "@/lib/stats-timezone";
import {
  detectViewerTimeZone,
  readViewerTimeZoneCookie,
} from "@/lib/viewer-timezone-client";

function TopTracksContent() {
  const searchParams = useSearchParams();
  const { streams, loading } = useStreams();

  const range = searchParams.get("range") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const viewerTimeZone =
    searchParams.get(VIEWER_TIMEZONE_PARAM) ??
    readViewerTimeZoneCookie() ??
    detectViewerTimeZone();
  const sortBy = parseTopSortBy(searchParams.get("sort") ?? undefined);
  const filter = useMemo(
    () => parseTimeRange(range, from, to, viewerTimeZone ?? undefined),
    [range, from, to, viewerTimeZone]
  );
  const tracks = useMemo(() => computeTopTracks(streams, 50, filter, sortBy), [streams, filter, sortBy]);

  if (loading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-10">
      <PageHeader
        title="Top tracks"
        description={`The songs you came back to most in this period. Ranked by ${topSortLabel(sortBy)}.`}
        periodLabel={filter.label}
      >
        <TopListToolbar />
      </PageHeader>

      <Card className="border-border/50 bg-card/70">
        <CardContent className="pt-6">
          {tracks.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No data for this time range.</p>
          ) : (
            <div className="grid gap-2 xl:grid-cols-2">
              {tracks.map((track, i) => (
                <RankedStreamRow
                  key={`${track.trackId}-${i}`}
                  rank={i + 1}
                  padding="compact"
                  sortBy={sortBy}
                  leading={
                    track.albumArt ? (
                      <Image
                        src={track.albumArt}
                        alt={track.albumName}
                        width={44}
                        height={44}
                        className="shrink-0 rounded"
                      />
                    ) : (
                      <div className="h-11 w-11 shrink-0 rounded bg-secondary" />
                    )
                  }
                  title={track.trackName}
                  subtitle={track.artistName}
                  streams={track.streams}
                  minutes={track.minutesListened}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function TopTracksPage() {
  return (
    <Suspense fallback={<p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>}>
      <TopTracksContent />
    </Suspense>
  );
}
