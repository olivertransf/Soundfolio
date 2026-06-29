"use client";

import { Suspense, useMemo } from "react";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { ArtistArt } from "@/components/artist-art";
import { EntityHero, EntityStatPill } from "@/components/entity/entity-hero";
import { ContentPanel, PageShell, SectionBlock } from "@/components/page-shell";
import { RankedEntityList } from "@/components/ranked-entity-list";
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
  const { streams, loading, refreshing } = useStreams();
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
    return <p className="py-16 text-center text-sm text-muted-foreground">Loading artist…</p>;
  }

  return (
    <PageShell width="default">
      <EntityHero
        eyebrow="Artist"
        title={detail.artistName}
        artwork={<ArtistArt src={detail.artistArt} alt={detail.artistName} width={112} height={112} className="size-full" />}
        stats={
          <>
            <EntityStatPill label="Plays" value={detail.streams.toLocaleString()} />
            <EntityStatPill label="Minutes" value={detail.minutesListened.toLocaleString()} />
            {refreshing ? <EntityStatPill label="Cache" value="updating" /> : null}
          </>
        }
      />

      <div className="grid gap-3 xl:grid-cols-2">
        <SectionBlock title="Top tracks">
          <ContentPanel>
            <RankedEntityList
              columns="one"
              sortBy={sortBy}
              items={detail.topTracks.map((track) => ({
                key: track.trackId,
                href: trackPath(track.artistName, track.trackName),
                title: track.trackName,
                subtitle: track.albumName,
                streams: track.streams,
                minutes: track.minutesListened,
                leading: track.albumArt ? (
                  <Image src={track.albumArt} alt={track.albumName} width={36} height={36} className="size-9 rounded" />
                ) : (
                  <div className="size-9 rounded bg-secondary" />
                ),
              }))}
            />
          </ContentPanel>
        </SectionBlock>

        <SectionBlock title="Top albums">
          <ContentPanel>
            <RankedEntityList
              columns="one"
              sortBy={sortBy}
              items={detail.topAlbums.map((album) => ({
                key: `${album.albumName}-${album.artistName}`,
                href: albumPath(album.artistName, album.albumName),
                title: album.albumName,
                subtitle: album.artistName,
                streams: album.streams,
                minutes: album.minutesListened,
                leading: album.albumArt ? (
                  <Image src={album.albumArt} alt={album.albumName} width={36} height={36} className="size-9 rounded" />
                ) : (
                  <div className="size-9 rounded bg-secondary" />
                ),
              }))}
            />
          </ContentPanel>
        </SectionBlock>
      </div>
    </PageShell>
  );
}

export function ArtistDetailContent() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-sm text-muted-foreground">Loading artist…</p>}>
      <ArtistDetailInner />
    </Suspense>
  );
}
