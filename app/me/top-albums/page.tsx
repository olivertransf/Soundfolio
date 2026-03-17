import { Suspense } from "react";
import { getTopAlbums, parseTimeRange } from "@/lib/stats";
import { TimeRangeTabs } from "@/components/time-range-tabs";
import { Card, CardContent } from "@/components/ui/card";
import { AlbumArt } from "@/components/album-art";
import { Clock, Headphones } from "lucide-react";

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
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Top Albums</h1>
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
          {albums.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No data for this time range.</p>
          ) : (
            <div className="space-y-1">
              {albums.map((album, i) => (
                <div
                  key={`${album.albumName}-${album.artistName}`}
                  className="flex items-center gap-4 px-2 py-3 rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <span className="text-sm text-muted-foreground w-7 text-right shrink-0">
                    {i + 1}
                  </span>
                  <AlbumArt
                    src={album.albumArt}
                    alt={album.albumName}
                    width={44}
                    height={44}
                    className="rounded shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{album.albumName}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {album.artistName}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Headphones className="h-3.5 w-3.5" />
                      {album.streams.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1.5 w-24 text-right justify-end">
                      <Clock className="h-3.5 w-3.5" />
                      {album.minutesListened.toLocaleString()} min
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
