import { Suspense } from "react";
import { getTopArtists, parseTimeRange } from "@/lib/stats";
import { TimeRangeTabs } from "@/components/time-range-tabs";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ArtistArt } from "@/components/artist-art";
import { RankedStreamRow } from "@/components/ranked-stream-row";

export const dynamic = "force-dynamic";

export default async function TopArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const filter = parseTimeRange(params.range, params.from, params.to);
  const artists = await getTopArtists(50, filter);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Top artists"
        description="Ranked by stream count for the selected period."
        periodLabel={filter.label}
      >
        <Suspense>
          <TimeRangeTabs />
        </Suspense>
      </PageHeader>

      <Card className="border-border/80">
        <CardContent className="pt-6">
          {artists.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No data for this time range.</p>
          ) : (
            <div className="space-y-1">
              {artists.map((artist, i) => (
                <RankedStreamRow
                  key={artist.artistName}
                  rank={i + 1}
                  leading={
                    <ArtistArt
                      src={artist.artistArt}
                      alt={artist.artistName}
                      width={44}
                      height={44}
                      className="shrink-0"
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
