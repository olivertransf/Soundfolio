import { Suspense } from "react";
import { getTopAlbums, parseTimeRange } from "@/lib/stats";
import { TimeRangeTabs } from "@/components/time-range-tabs";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { AlbumArt } from "@/components/album-art";
import { RankedStreamRow } from "@/components/ranked-stream-row";

export const dynamic = "force-dynamic";

export default async function TopAlbumsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const filter = parseTimeRange(params.range, params.from, params.to);
  const albums = await getTopAlbums(50, filter);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Top albums"
        description="Ranked by stream count for the selected period."
        periodLabel={filter.label}
      >
        <Suspense>
          <TimeRangeTabs />
        </Suspense>
      </PageHeader>

      <Card className="border-border/80">
        <CardContent className="pt-6">
          {albums.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No data for this time range.</p>
          ) : (
            <div className="space-y-1">
              {albums.map((album, i) => (
                <RankedStreamRow
                  key={`${album.albumName}-${album.artistName}`}
                  rank={i + 1}
                  leading={
                    <AlbumArt
                      src={album.albumArt}
                      alt={album.albumName}
                      width={44}
                      height={44}
                      className="rounded shrink-0"
                    />
                  }
                  title={album.albumName}
                  subtitle={album.artistName}
                  streams={album.streams}
                  minutes={album.minutesListened}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
