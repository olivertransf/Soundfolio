import { getTopTracks, parseTimeRange, parseTopSortBy, topSortLabel } from "@/lib/stats";
import { TopListToolbar } from "@/components/top-list-toolbar";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { RankedStreamRow } from "@/components/ranked-stream-row";
import { cookies } from "next/headers";
import { VIEWER_TIMEZONE_COOKIE } from "@/lib/stats-timezone";
export const dynamic = "force-dynamic";

export default async function TopTracksPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; tz?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const viewerTimeZone = params.tz ?? cookieStore.get(VIEWER_TIMEZONE_COOKIE)?.value;
  const filter = parseTimeRange(params.range, params.from, params.to, viewerTimeZone);
  const sortBy = parseTopSortBy(params.sort);
  const tracks = await getTopTracks(50, filter, "me", sortBy);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Top tracks"
        description={`The songs you came back to most in this period. Ranked by ${topSortLabel(sortBy)}.`}
        periodLabel={filter.label}
      >
        <TopListToolbar />
      </PageHeader>

      <Card className="border-border/50 bg-card/70">
        <CardContent className="pt-6">
          {tracks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No data for this time range.</p>
          ) : (
            <div className="grid gap-2 xl:grid-cols-2">
              {tracks.map((track, i) => (
                <RankedStreamRow
                  key={`${track.trackId}-${i}`}
                  rank={i + 1}
                  padding="compact"
                  sortBy={sortBy}
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
