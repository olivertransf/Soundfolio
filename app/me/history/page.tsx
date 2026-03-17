"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListeningChart } from "@/components/listening-chart";
import { TimeRangeTabs } from "@/components/time-range-tabs";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Mode = "weeks" | "months";

interface ChartPoint {
  label: string;
  minutes: number;
  streams: number;
}

function HistoryContent() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("months");
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const range = searchParams.get("range") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ mode });
    if (range) params.set("range", range);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/stats/history?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d.data ?? []);
        setLoading(false);
      });
  }, [mode, range, from, to]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Listening History</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Minutes listened over time
          </p>
        </div>
        <div className="flex items-center gap-4">
          <TimeRangeTabs />
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="bg-secondary">
              <TabsTrigger value="weeks" className="text-xs">By Week</TabsTrigger>
              <TabsTrigger value="months" className="text-xs">By Month</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {mode === "months" ? "Last 12 months" : "Last 26 weeks"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              Loading...
            </div>
          ) : data.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              No data yet. Import your Spotify history first.
            </div>
          ) : (
            <ListeningChart data={data} mode={mode} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading...</div>}>
      <HistoryContent />
    </Suspense>
  );
}
