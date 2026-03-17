import { Suspense } from "react";
import { getTopArtists, parseTimeRange } from "@/lib/stats";
import { TimeRangeTabs } from "@/components/time-range-tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ArtistArt } from "@/components/artist-art";
import { Clock, Headphones } from "lucide-react";

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
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Top Artists</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Ranked by stream count
          </p>
        </div>
        <Suspense>
          <TimeRangeTabs />
        </Suspense>
      </div>

      <Card>
        <CardContent className="pt-6">
          {artists.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No data for this time range.</p>
          ) : (
            <div className="space-y-1">
              {artists.map((artist, i) => (
                <div
                  key={artist.artistName}
                  className="flex items-center gap-4 px-2 py-3 rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <span className="text-sm text-muted-foreground w-7 text-right shrink-0">
                    {i + 1}
                  </span>
                  <ArtistArt
                    src={artist.artistArt}
                    alt={artist.artistName}
                    width={44}
                    height={44}
                    className="shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{artist.artistName}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Headphones className="h-3.5 w-3.5" />
                      {artist.streams.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1.5 w-24 text-right justify-end">
                      <Clock className="h-3.5 w-3.5" />
                      {artist.minutesListened.toLocaleString()} min
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
