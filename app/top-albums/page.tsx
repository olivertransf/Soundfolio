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
  computeTopAlbums,
  parseTimeRange,
  parseTopSortBy,
  topSortLabel,
} from "@/lib/stats-compute";
import { VIEWER_TIMEZONE_PARAM } from "@/lib/stats-timezone";
import {
  detectViewerTimeZone,
  readViewerTimeZoneCookie,
} from "@/lib/viewer-timezone-client";

function TopAlbumsContent() {
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
  const albums = useMemo(() => computeTopAlbums(streams, 50, filter, sortBy), [streams, filter, sortBy]);

  if (loading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-10">
      <PageHeader
        title="Top albums"
        description={`Albums with the strongest repeat listening. Ranked by ${topSortLabel(sortBy)}.`}
        periodLabel={filter.label}
      >
        <TopListToolbar />
      </PageHeader>

      <Card className="border-border/50 bg-card/70">
        <CardContent className="pt-6">
          {albums.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No data for this time range.</p>
          ) : (
            <div className="grid gap-2 xl:grid-cols-2">
              {albums.map((album, i) => (
                <RankedStreamRow
                  key={`${album.albumName}-${album.artistName}`}
                  rank={i + 1}
                  sortBy={sortBy}
                  leading={
                    album.albumArt ? (
                      <Image
                        src={album.albumArt}
                        alt={album.albumName}
                        width={44}
                        height={44}
                        className="shrink-0 rounded"
                      />
                    ) : (
                      <div className="h-11 w-11 shrink-0 rounded bg-secondary" />
                    )
                  }
                  title={album.albumName}
                  subtitle={album.artistName}
                  streams={album.streams}
                  minutes={album.minutesListened}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function TopAlbumsPage() {
  return (
    <Suspense fallback={<p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>}>
      <TopAlbumsContent />
    </Suspense>
  );
}
