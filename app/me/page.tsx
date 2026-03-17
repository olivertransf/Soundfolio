import { Suspense } from "react";
import { Clock, Headphones, Music, Mic2 } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListeningChart } from "@/components/listening-chart";
import { TimeRangeTabs } from "@/components/time-range-tabs";
import {
  getTotalStats,
  getTopTracks,
  getTopArtists,
  getStreamsByMonth,
  getLastSyncedAt,
  parseTimeRange,
} from "@/lib/stats";
import { formatDistanceToNow } from "date-fns";
import { AlbumArt } from "@/components/album-art";
import { ArtistArt } from "@/components/artist-art";

export const dynamic = "force-dynamic";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const filter = parseTimeRange(params.range, params.from, params.to);

  const [stats, topTracks, topArtists, monthlyData, lastSynced] = await Promise.all([
    getTotalStats(filter),
    getTopTracks(5, filter),
    getTopArtists(5, filter),
    getStreamsByMonth(12, filter),
    getLastSyncedAt(),
  ]);

  const chartData = monthlyData.map((d) => ({
    label: d.month,
    minutes: d.minutes,
    streams: d.streams,
  }));

  const hasData = stats.totalStreams > 0;

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-4">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Music className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">No data yet</h1>
        <p className="text-muted-foreground max-w-sm">
          Import your Spotify data export to see your full listening history and stats.
        </p>
        <a
          href="/me/import"
          className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
        >
          Import Data
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Overview</h1>
          {lastSynced && (
            <p className="text-muted-foreground text-sm mt-1">
              Last synced {formatDistanceToNow(lastSynced, { addSuffix: true })}
            </p>
          )}
        </div>
        <Suspense>
          <TimeRangeTabs />
        </Suspense>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Minutes"
          value={stats.totalMinutes.toLocaleString()}
          sub={`${stats.totalHours.toLocaleString()} hours`}
          icon={Clock}
        />
        <StatCard
          label="Total Streams"
          value={stats.totalStreams.toLocaleString()}
          icon={Headphones}
        />
        <StatCard
          label="Top Track"
          value={topTracks[0]?.trackName ?? "—"}
          sub={topTracks[0]?.artistName}
          icon={Music}
        />
        <StatCard
          label="Top Artist"
          value={topArtists[0]?.artistName ?? "—"}
          sub={topArtists[0] ? `${topArtists[0].streams.toLocaleString()} streams` : undefined}
          icon={Mic2}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Listening Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ListeningChart data={chartData} mode="months" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Tracks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topTracks.map((track, i) => (
              <div key={track.trackId} className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-4 shrink-0">{i + 1}</span>
                <AlbumArt
                  src={track.albumArt}
                  alt={track.albumName}
                  width={36}
                  height={36}
                  className="rounded"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{track.trackName}</p>
                  <p className="text-xs text-muted-foreground truncate">{track.artistName}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {track.streams} plays
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Artists</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topArtists.map((artist, i) => (
              <div key={artist.artistName} className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-4 shrink-0">{i + 1}</span>
                <ArtistArt src={artist.artistArt} alt={artist.artistName} width={32} height={32} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{artist.artistName}</p>
                  <p className="text-xs text-muted-foreground">
                    {artist.minutesListened.toLocaleString()} min
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {artist.streams.toLocaleString()} plays
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
