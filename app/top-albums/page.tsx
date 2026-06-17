import { getTopAlbums, parseTimeRange, parseTopSortBy, topSortLabel } from "@/lib/stats";
import { TopListToolbar } from "@/components/top-list-toolbar";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { RankedStreamRow } from "@/components/ranked-stream-row";
import { cookies } from "next/headers";
import { VIEWER_TIMEZONE_COOKIE } from "@/lib/stats-timezone";
import { requireOnboardedSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function TopAlbumsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; tz?: string; sort?: string }>;
}) {
  const session = await requireOnboardedSession("/top-albums");
  const userId = session.uid;
  const params = await searchParams;
  const cookieStore = await cookies();
  const viewerTimeZone = params.tz ?? cookieStore.get(VIEWER_TIMEZONE_COOKIE)?.value;
  const filter = parseTimeRange(params.range, params.from, params.to, viewerTimeZone);
  const sortBy = parseTopSortBy(params.sort);
  const albums = await getTopAlbums(50, filter, "me", sortBy, userId);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Top albums"
        description={`Albums with the strongest repeat listening. Ranked by ${topSortLabel(sortBy)}.`}
        periodLabel={filter.label}
      >
        <TopListToolbar />
      </PageHeader>

      <Card className="border-border/50 bg-card/70">
        <CardContent className="pt-6">
          {albums.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No data for this time range.</p>
          ) : (
            <div className="grid gap-2 xl:grid-cols-2">
              {albums.map((album, i) => (
                <RankedStreamRow
                  key={`${album.albumName}-${album.artistName}`}
                  rank={i + 1}
                  sortBy={sortBy}
                  leading={
                    album.albumArt ? (
                      <Image
                        src={album.albumArt}
                        alt={album.albumName}
                        width={44}
                        height={44}
                        className="shrink-0 rounded"
                      />
                    ) : (
                      <div className="h-11 w-11 shrink-0 rounded bg-secondary" />
                    )
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
