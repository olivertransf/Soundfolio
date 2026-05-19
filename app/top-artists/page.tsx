import { Suspense } from "react";
import { getTopArtists, parseTimeRange } from "@/lib/stats";
import { TimeRangeTabs } from "@/components/time-range-tabs";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { RankedStreamRow } from "@/components/ranked-stream-row";
import { ArtistArt } from "@/components/artist-art";
import { cookies } from "next/headers";
import { VIEWER_TIMEZONE_COOKIE } from "@/lib/stats-timezone";

export const dynamic = "force-dynamic";

export default async function TopArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; tz?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const viewerTimeZone = params.tz ?? cookieStore.get(VIEWER_TIMEZONE_COOKIE)?.value;
  const filter = parseTimeRange(params.range, params.from, params.to, viewerTimeZone);
  const artists = await getTopArtists(50, filter);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Top artists"
        description="The artists taking up the most space in your rotation."
        periodLabel={filter.label}
      >
        <Suspense>
          <TimeRangeTabs />
        </Suspense>
      </PageHeader>

      <Card className="border-border/50 bg-card/70">
        <CardContent className="pt-6">
          {artists.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No data for this time range.</p>
          ) : (
            <div className="grid gap-2 xl:grid-cols-2">
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
                      className="ring-1 ring-border/40"
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
