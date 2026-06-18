"use client";

import { Suspense, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArtistArt } from "@/components/artist-art";
import { RankedStreamRow } from "@/components/ranked-stream-row";
import { Card, CardContent } from "@/components/ui/card";
import { useStreams } from "@/components/streams-provider";
import {
  computeArtistDetail,
  parseTimeRange,
  parseTopSortBy,
} from "@/lib/stats-compute";
import { albumPath, trackPath } from "@/lib/entity-paths";
import { VIEWER_TIMEZONE_PARAM } from "@/lib/stats-timezone";
import {
  detectViewerTimeZone,
  readViewerTimeZoneCookie,
} from "@/lib/viewer-timezone-client";

function ArtistDetailInner() {
  const params = useParams<{ name: string }>();
  const searchParams = useSearchParams();
  const { streams, loading } = useStreams();
  const artistName = decodeURIComponent(params.name);
  const sortBy = parseTopSortBy(searchParams.get("sort") ?? undefined);
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
    () => computeArtistDetail(streams, artistName, filter, sortBy),
    [streams, artistName, filter, sortBy]
  );

  if (loading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex gap-4">
        <ArtistArt src={detail.artistArt} alt={detail.artistName} width={96} height={96} />
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{detail.artistName}</h1>
          <p className="text-sm text-muted-foreground">
            {detail.streams.toLocaleString()} plays · {detail.minutesListened.toLocaleString()} min
          </p>
        </div>
      </div>

      <RankedSection title="Top tracks" items={detail.topTracks.map((track) => ({
        key: track.trackId,
        href: trackPath(track.artistName, track.trackName),
        title: track.trackName,
        subtitle: track.albumName,
        streams: track.streams,
        minutes: track.minutesListened,
        leading: track.albumArt ? <Image src={track.albumArt} alt={track.albumName} width={44} height={44} className="rounded" /> : <div className="size-11 rounded bg-secondary" />,
      }))} sortBy={sortBy} />

      <RankedSection title="Top albums" items={detail.topAlbums.map((album) => ({
        key: `${album.albumName}-${album.artistName}`,
        href: albumPath(album.artistName, album.albumName),
        title: album.albumName,
        subtitle: album.artistName,
        streams: album.streams,
        minutes: album.minutesListened,
        leading: album.albumArt ? <Image src={album.albumArt} alt={album.albumName} width={44} height={44} className="rounded" /> : <div className="size-11 rounded bg-secondary" />,
      }))} sortBy={sortBy} />
    </div>
  );
}

function RankedSection({
  title,
  items,
  sortBy,
}: {
  title: string;
  items: Array<{
    key: string;
    href: string;
    title: string;
    subtitle: string;
    streams: number;
    minutes: number;
    leading: React.ReactNode;
  }>;
  sortBy: "minutes" | "streams";
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      <Card>
        <CardContent className="pt-4">
          {items.map((item, i) => (
            <RankedStreamRow
              key={item.key}
              rank={i + 1}
              href={item.href}
              leading={item.leading}
              title={item.title}
              subtitle={item.subtitle}
              streams={item.streams}
              minutes={item.minutes}
              sortBy={sortBy}
              padding="compact"
            />
          ))}
        </CardContent>
      </Card>
    </section>
  );
}

export function ArtistDetailContent() {
  return (
    <Suspense fallback={<p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>}>
      <ArtistDetailInner />
    </Suspense>
  );
}
