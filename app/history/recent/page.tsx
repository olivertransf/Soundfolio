import { getRecentStreams } from "@/lib/stats";
import { Card, CardContent } from "@/components/ui/card";
import { RecentPlaysList } from "@/components/recent-plays-list";

export const dynamic = "force-dynamic";

export default async function HistoryRecentPage() {
  const streams = await getRecentStreams(100);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="sr-only">
        <h1 className="text-3xl font-bold tracking-tight">Recent</h1>
      </div>

      <Card className="border-border/50 bg-card/70">
        <CardContent className="p-3 sm:p-4">
          <RecentPlaysList
            initialStreams={streams.map((stream) => ({
              ...stream,
              playedAt: stream.playedAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
