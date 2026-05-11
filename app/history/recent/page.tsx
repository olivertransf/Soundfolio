import { getRecentStreams } from "@/lib/stats";
import { Card, CardContent } from "@/components/ui/card";
import { LocalDateTime } from "@/components/local-datetime";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function HistoryRecentPage() {
  const streams = await getRecentStreams(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Recent plays</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your last {streams.length} tracks</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {streams.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No streams yet. Import your Spotify data from the Import tab to get started.
            </p>
          ) : (
            <div className="space-y-1">
              {streams.map((stream) => (
                <div
                  key={stream.id}
                  className="group flex items-center gap-4 rounded-lg px-2 py-2.5 transition-colors hover:bg-secondary/50"
                >
                  {stream.albumArt ? (
                    <Image
                      src={stream.albumArt}
                      alt={stream.albumName}
                      width={40}
                      height={40}
                      className="shrink-0 rounded"
                    />
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded bg-secondary" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{stream.trackName}</p>
                    <p className="truncate text-xs text-muted-foreground">
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
