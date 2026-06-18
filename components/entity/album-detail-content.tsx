"use client";

import { Suspense, useMemo } from "react";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { RankedStreamRow } from "@/components/ranked-stream-row";
import { useStreams } from "@/components/streams-provider";
import { computeAlbumDetail, parseTimeRange } from "@/lib/stats-compute";
import { trackPath } from "@/lib/entity-paths";
import { VIEWER_TIMEZONE_PARAM } from "@/lib/stats-timezone";
import {
  detectViewerTimeZone,
  readViewerTimeZoneCookie,
} from "@/lib/viewer-timezone-client";

function AlbumDetailInner() {
  const params = useParams<{ artist: string; name: string }>();
  const searchParams = useSearchParams();
  const { streams, loading } = useStreams();
  const artistName = decodeURIComponent(params.artist);
  const albumName = decodeURIComponent(params.name);
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
    () => computeAlbumDetail(streams, albumName, artistName, filter),
    [streams, albumName, artistName, filter]
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
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{detail.albumName}</h1>
          <p className="text-muted-foreground">{detail.artistName}</p>
          <p className="text-sm text-muted-foreground">
            {detail.streams.toLocaleString()} plays · {detail.minutesListened.toLocaleString()} min
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Tracks</h2>
        <Card>
          <CardContent className="pt-4">
            {detail.tracks.map((track, i) => (
              <RankedStreamRow
                key={track.trackName}
                rank={i + 1}
                href={trackPath(detail.artistName, track.trackName)}
                leading={detail.albumArt ? <Image src={detail.albumArt} alt={detail.albumName} width={44} height={44} className="rounded" /> : <div className="size-11 rounded bg-secondary" />}
                title={track.trackName}
                subtitle={`${track.streams.toLocaleString()} plays`}
                streams={track.streams}
                minutes={track.minutes}
                sortBy="minutes"
                padding="compact"
              />
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export function AlbumDetailContent() {
  return (
    <Suspense fallback={<p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>}>
      <AlbumDetailInner />
    </Suspense>
  );
}
