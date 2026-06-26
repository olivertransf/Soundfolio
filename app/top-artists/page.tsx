"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { TopListToolbar } from "@/components/top-list-toolbar";
import { PageHeader } from "@/components/page-header";
import { PageHistoryActions } from "@/components/page-history-actions";
import { Card, CardContent } from "@/components/ui/card";
import { RankedStreamRow } from "@/components/ranked-stream-row";
import { ArtistArt } from "@/components/artist-art";
import { useStreams } from "@/components/streams-provider";
import {
  computeTopArtists,
  parseTimeRange,
  parseTopSortBy,
  topSortLabel,
} from "@/lib/stats-compute";
import { VIEWER_TIMEZONE_PARAM } from "@/lib/stats-timezone";
import {
  detectViewerTimeZone,
  readViewerTimeZoneCookie,
} from "@/lib/viewer-timezone-client";

function TopArtistsContent() {
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
  const artists = useMemo(() => computeTopArtists(streams, 50, filter, sortBy), [streams, filter, sortBy]);

  if (loading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-10">
      <PageHeader
        title="Top artists"
        description={`The artists taking up the most space in your rotation. Ranked by ${topSortLabel(sortBy)}.`}
        periodLabel={filter.label}
      >
        <div className="flex w-full flex-col gap-3">
          <PageHistoryActions />
          <TopListToolbar />
        </div>
      </PageHeader>

      <Card className="border-border/50 bg-card/70">
        <CardContent className="pt-6">
          {artists.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No data for this time range.</p>
          ) : (
            <div className="grid gap-2 xl:grid-cols-2">
              {artists.map((artist, i) => (
                <RankedStreamRow
                  key={artist.artistName}
                  rank={i + 1}
                  sortBy={sortBy}
                  href={`/artist/${encodeURIComponent(artist.artistName)}`}
                  leading={
                    <ArtistArt
                      src={artist.artistArt}
                      alt={artist.artistName}
                      width={44}
                      height={44}
                      className="ring-1 ring-border/40"
                    />
                  }
                  title={artist.artistName}
                  streams={artist.streams}
                  minutes={artist.minutesListened}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function TopArtistsPage() {
  return (
    <Suspense fallback={<p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>}>
      <TopArtistsContent />
    </Suspense>
  );
}
