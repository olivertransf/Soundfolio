"use client";

import { Card, CardContent } from "@/components/ui/card";
import { RecentPlaysList } from "@/components/recent-plays-list";
import { useStreams } from "@/components/streams-provider";
import { computeRecentStreams } from "@/lib/stats-compute";
import { useMemo } from "react";

export default function HistoryRecentPage() {
  const { streams, loading } = useStreams();
  const recent = useMemo(() => computeRecentStreams(streams, 100), [streams]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="sr-only">
        <h1 className="text-3xl font-bold tracking-tight">Recent</h1>
      </div>

      <Card className="border-border/50 bg-card/70">
        <CardContent className="p-3 sm:p-4">
          <RecentPlaysList
            initialStreams={recent.map((stream) => ({
              ...stream,
              playedAt: stream.playedAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
