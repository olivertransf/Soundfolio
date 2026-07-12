"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { AlbumArt } from "@/components/album-art";
import { EntityHero, EntityStatPill } from "@/components/entity/entity-hero";
import { ContentPanel, PageShell, SectionBlock } from "@/components/page-shell";
import { LocalDateTime } from "@/components/local-datetime";
import { useStreams } from "@/components/streams-provider";
import {
  computeTrackDetail,
  parseTimeRange,
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
  const { streams, loading, refreshing } = useStreams();

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
    return <p className="py-16 text-center text-sm text-muted-foreground">Loading track…</p>;
  }

  return (
    <PageShell width="default">
      <EntityHero
        eyebrow="Track"
        title={detail.trackName}
        subtitle={
          <span>
            {detail.artistName}
            {detail.albumName ? (
              <>
                {" · "}
                <Link href={albumPath(detail.artistName, detail.albumName)} className="text-primary hover:underline">
                  {detail.albumName}
                </Link>
              </>
            ) : null}
          </span>
        }
        artwork={
          <AlbumArt
            src={detail.albumArt}
            alt={detail.albumName}
            width={112}
            height={112}
            className="size-full object-cover"
          />
        }
        stats={
          <>
            <EntityStatPill label="Plays" value={detail.streams.toLocaleString()} />
            <EntityStatPill label="Minutes" value={detail.minutesListened.toLocaleString()} />
            {detail.firstPlayedAt ? (
              <EntityStatPill label="First" value={<LocalDateTime date={detail.firstPlayedAt.toISOString()} pattern="MMM d, yyyy" />} />
            ) : null}
            {detail.lastPlayedAt ? (
              <EntityStatPill label="Last" value={<LocalDateTime date={detail.lastPlayedAt.toISOString()} pattern="MMM d, yyyy" />} />
            ) : null}
            {refreshing ? <EntityStatPill label="Cache" value="updating" /> : null}
          </>
        }
      />

      {detail.recentPlays.length > 0 ? (
        <SectionBlock title="Recent plays in period">
          <ContentPanel>
            <div className="grid gap-x-4 divide-y divide-border/30 md:grid-cols-2 md:divide-y-0 xl:grid-cols-3">
              {detail.recentPlays.map((play) => (
                <div key={play.id} className="flex items-center justify-between gap-3 px-1 py-2 text-sm">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    <LocalDateTime date={play.playedAt.toISOString()} pattern="MMM d · h:mm a" />
                  </span>
                  <span className="min-w-0 truncate text-xs">{play.albumName}</span>
                </div>
              ))}
            </div>
          </ContentPanel>
        </SectionBlock>
      ) : null}
    </PageShell>
  );
}

export function TrackDetailContent() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-sm text-muted-foreground">Loading track…</p>}>
      <TrackDetailInner />
    </Suspense>
  );
}
