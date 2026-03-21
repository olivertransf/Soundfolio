import { getRecentStreams } from "@/lib/stats";
import { Card, CardContent } from "@/components/ui/card";
import { LocalDateTime } from "@/components/local-datetime";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function RecentPage() {
  const streams = await getRecentStreams(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Recent Plays</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your last {streams.length} tracks
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {streams.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No streams yet. Import your Spotify data to get started.
            </p>
          ) : (
            <div className="space-y-1">
              {streams.map((stream, i) => (
                <div
                  key={stream.id}
                  className="flex items-center gap-4 px-2 py-2.5 rounded-lg hover:bg-secondary/50 transition-colors group"
                >
                  {stream.albumArt ? (
                    <Image
                      src={stream.albumArt}
                      alt={stream.albumName}
                      width={40}
                      height={40}
                      className="rounded shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-secondary shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{stream.trackName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {stream.artistName} · {stream.albumName}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">
                      <LocalDateTime date={stream.playedAt} pattern="MMM d, yyyy" />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <LocalDateTime date={stream.playedAt} pattern="h:mm a" />
                    </p>
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
