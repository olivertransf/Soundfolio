"use client";

import { Suspense, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { RankedStreamRow } from "@/components/ranked-stream-row";
import { useStreams } from "@/components/streams-provider";
import {
  computeTrackDetail,
  parseTimeRange,
  parseTopSortBy,
} from "@/lib/stats-compute";
import { albumPath } from "@/lib/entity-paths";
import { VIEWER_TIMEZONE_PARAM } from "@/lib/stats-timezone";
import {
  detectViewerTimeZone,
  readViewerTimeZoneCookie,
} from "@/lib/viewer-timezone-client";

function TrackDetailInner() {
  const params = useParams<{ artist: string; name: string }>();
  const searchParams = useSearchParams();
  const { streams, loading } = useStreams();

  const artistName = decodeURIComponent(params.artist);
  const trackName = decodeURIComponent(params.name);
  const range = searchParams.get("range") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const viewerTimeZone =
    searchParams.get(VIEWER_TIMEZONE_PARAM) ??
    readViewerTimeZoneCookie() ??
    detectViewerTimeZone();
  const filter = useMemo(
    () => parseTimeRange(range, from, to, viewerTimeZone ?? undefined),
    [range, from, to, viewerTimeZone]
  );
  const detail = useMemo(
    () => computeTrackDetail(streams, trackName, artistName, filter),
    [streams, trackName, artistName, filter]
  );

  if (loading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex gap-4">
        {detail.albumArt ? (
          <Image src={detail.albumArt} alt={detail.albumName} width={96} height={96} className="rounded-xl" />
        ) : (
          <div className="size-24 rounded-xl bg-secondary" />
        )}
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{detail.trackName}</h1>
          <p className="text-muted-foreground">{detail.artistName}</p>
          <Link href={albumPath(detail.artistName, detail.albumName)} className="text-sm text-primary hover:underline">
            {detail.albumName}
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Plays</p><p className="text-2xl font-semibold">{detail.streams.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Minutes</p><p className="text-2xl font-semibold">{detail.minutesListened.toLocaleString()}</p></CardContent></Card>
      </div>

      {detail.firstPlayedAt && detail.lastPlayedAt ? (
        <p className="text-sm text-muted-foreground">
          First: {detail.firstPlayedAt.toLocaleString()} · Last: {detail.lastPlayedAt.toLocaleString()}
        </p>
      ) : null}

      {detail.recentPlays.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Recent plays in period</h2>
          <Card>
            <CardContent className="divide-y divide-border/30 p-3">
              {detail.recentPlays.map((play) => (
                <div key={play.id} className="flex justify-between gap-3 py-2 text-sm">
                  <span className="text-muted-foreground">{play.playedAt.toLocaleString()}</span>
                  <span className="truncate">{play.albumName}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

export function TrackDetailContent() {
  return (
    <Suspense fallback={<p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>}>
      <TrackDetailInner />
    </Suspense>
  );
}
