"use client";

import { Suspense, useMemo } from "react";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { EntityHero, EntityStatPill } from "@/components/entity/entity-hero";
import { ContentPanel, PageShell, SectionBlock } from "@/components/page-shell";
import { RankedEntityList } from "@/components/ranked-entity-list";
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
  const { streams, loading, refreshing } = useStreams();
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
    return <p className="py-16 text-center text-sm text-muted-foreground">Loading album…</p>;
  }

  return (
    <PageShell width="default">
      <EntityHero
        eyebrow="Album"
        title={detail.albumName}
        subtitle={detail.artistName}
        artwork={
          detail.albumArt ? (
            <Image src={detail.albumArt} alt={detail.albumName} width={112} height={112} className="size-full object-cover" />
          ) : (
            <div className="size-full bg-secondary" />
          )
        }
        stats={
          <>
            <EntityStatPill label="Plays" value={detail.streams.toLocaleString()} />
            <EntityStatPill label="Minutes" value={detail.minutesListened.toLocaleString()} />
            <EntityStatPill label="Tracks" value={detail.tracks.length.toLocaleString()} />
            {refreshing ? <EntityStatPill label="Cache" value="updating" /> : null}
          </>
        }
      />

      <SectionBlock title="Tracks">
        <ContentPanel>
          <RankedEntityList
            columns="two"
            sortBy="minutes"
            items={detail.tracks.map((track) => ({
              key: track.trackName,
              href: trackPath(detail.artistName, track.trackName),
              title: track.trackName,
              subtitle: `${track.streams.toLocaleString()} plays`,
              streams: track.streams,
              minutes: track.minutes,
              leading: detail.albumArt ? (
                <Image src={detail.albumArt} alt={detail.albumName} width={36} height={36} className="size-9 rounded" />
              ) : (
                <div className="size-9 rounded bg-secondary" />
              ),
            }))}
          />
        </ContentPanel>
      </SectionBlock>
    </PageShell>
  );
}

export function AlbumDetailContent() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-sm text-muted-foreground">Loading album…</p>}>
      <AlbumDetailInner />
    </Suspense>
  );
}
