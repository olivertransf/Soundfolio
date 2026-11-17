"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlbumArt } from "@/components/album-art";
import { EntityHero } from "@/components/entity/entity-hero";
import { PageShell } from "@/components/page-shell";
import { useStreams } from "@/components/streams-provider";
import { CoverRail } from "@/components/visual/cover-rail";
import { EntityCharts } from "@/components/visual/entity-charts";
import { playCovers } from "@/components/visual/rank-covers";
import { ResultLine, scopeResultLine } from "@/components/visual/result-line";
import { useBasePath } from "@/components/visual/use-base-path";
import { useViewerTimeZone } from "@/components/visual/use-viewer-time-zone";
import { historyChartData } from "@/lib/stats-chart-data";
import {
  calendarDaysInFilter,
  computeListeningSpan,
  computeStreamsByDayOfWeek,
  computeStreamsByHour,
  computeTrackDetail,
  parseTimeRange,
} from "@/lib/stats-compute";
import { matchesEntity } from "@/lib/entity-normalize";
import { albumPath } from "@/lib/entity-paths";

function TrackDetailInner() {
  const params = useParams<{ artist: string; name: string }>();
  const base = useBasePath();
  const timeZone = useViewerTimeZone();
  const { streams, loading } = useStreams();
  const artistName = decodeURIComponent(params.artist);
  const trackName = decodeURIComponent(params.name);
  const filter = useMemo(() => parseTimeRange("all", undefined, undefined, timeZone), [timeZone]);
  const detail = useMemo(
    () => computeTrackDetail(streams, trackName, artistName, filter),
    [streams, trackName, artistName, filter]
  );
  const scoped = useMemo(
    () =>
      streams.filter(
        (row) => matchesEntity(row.trackName, trackName) && matchesEntity(row.artistName, artistName)
      ),
    [streams, trackName, artistName]
  );
  const span = useMemo(() => computeListeningSpan(scoped, filter), [scoped, filter]);
  const days = calendarDaysInFilter(filter, span, timeZone);
  const mode = days > 400 ? "months" : days > 120 ? "weeks" : "days";
  const history = useMemo(
    () => historyChartData(scoped, mode, filter, timeZone),
    [scoped, mode, filter, timeZone]
  );
  const hours = useMemo(
    () => computeStreamsByHour(scoped, filter, timeZone),
    [scoped, filter, timeZone]
  );
  const weekdays = useMemo(
    () => computeStreamsByDayOfWeek(scoped, filter, timeZone),
    [scoped, filter, timeZone]
  );

  if (loading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Loading track…</p>;
  }

  const line =
    detail.streams > 0
      ? scopeResultLine({
          minutes: detail.minutesListened,
          scope: `of ${detail.trackName}`,
          when: `${detail.streams.toLocaleString()} plays`,
        })
      : `No plays of ${detail.trackName}.`;

  return (
    <PageShell className="space-y-6">
      <EntityHero
        title={detail.trackName}
        subtitle={
          <span>
            {detail.artistName}
            {detail.albumName ? (
              <>
                {" · "}
                <Link href={`${base}${albumPath(detail.artistName, detail.albumName)}`} className="text-primary">
                  {detail.albumName}
                </Link>
              </>
            ) : null}
          </span>
        }
        artwork={
          <AlbumArt
            src={detail.albumArt}
            alt={detail.albumName || detail.trackName}
            width={176}
            height={176}
            className="size-full object-cover"
          />
        }
      >
        <ResultLine>{line}</ResultLine>
      </EntityHero>
      {detail.streams > 0 ? <EntityCharts history={history} hours={hours} weekdays={weekdays} /> : null}
      <CoverRail title="Recent" items={playCovers(detail.recentPlays.slice(0, 12))} />
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
