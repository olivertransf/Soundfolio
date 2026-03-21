import { Suspense } from "react";
import { getTopTracks, parseTimeRange } from "@/lib/stats";
import { TimeRangeTabs } from "@/components/time-range-tabs";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { RankedStreamRow } from "@/components/ranked-stream-row";

export const dynamic = "force-dynamic";

export default async function TopTracksPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const filter = parseTimeRange(params.range, params.from, params.to);
  const tracks = await getTopTracks(50, filter);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Top tracks"
        description="Ranked by stream count for the selected period."
        periodLabel={filter.label}
      >
        <Suspense>
          <TimeRangeTabs />
        </Suspense>
      </PageHeader>

      <Card className="border-border/80">
        <CardContent className="pt-6">
          {tracks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No data for this time range.</p>
          ) : (
            <div className="space-y-1">
              {tracks.map((track, i) => (
                <RankedStreamRow
                  key={`${track.trackId}-${i}`}
                  rank={i + 1}
                  padding="compact"
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
                  subtitle={`${track.artistName} · ${track.albumName}`}
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
