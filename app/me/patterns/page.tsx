import { Suspense } from "react";
import {
  getStreamsByHour,
  getStreamsByDayOfWeek,
  getListeningHeatmap,
  parseTimeRange,
} from "@/lib/stats";
import { TimeRangeTabs } from "@/components/time-range-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListeningChart } from "@/components/listening-chart";
import { ListeningHeatmap } from "@/components/listening-heatmap";

export const dynamic = "force-dynamic";

export default async function PatternsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const filter = parseTimeRange(params.range, params.from, params.to);

  const [byHour, byDay, heatmap] = await Promise.all([
    getStreamsByHour(filter),
    getStreamsByDayOfWeek(filter),
    getListeningHeatmap(filter),
  ]);

  const hourChartData = byHour.map((h) => ({
    label: h.label,
    minutes: h.minutes,
    streams: h.streams,
  }));

  const dayChartData = byDay.map((d) => ({
    label: d.label,
    minutes: d.minutes,
    streams: d.streams,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Listening Patterns</h1>
          <p className="text-muted-foreground text-sm mt-1">
            When you listen — by hour, day, and time of day
          </p>
        </div>
        <Suspense>
          <TimeRangeTabs />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By hour of day</CardTitle>
            <p className="text-sm text-muted-foreground">
              Minutes listened per hour (0–23)
            </p>
          </CardHeader>
          <CardContent>
            <ListeningChart data={hourChartData} mode="weeks" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">By day of week</CardTitle>
            <p className="text-sm text-muted-foreground">
              Minutes listened per day
            </p>
          </CardHeader>
          <CardContent>
            <ListeningChart data={dayChartData} mode="weeks" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Listening heatmap</CardTitle>
          <p className="text-sm text-muted-foreground">
            Day of week × hour — darker = more streams
          </p>
        </CardHeader>
        <CardContent>
          <ListeningHeatmap grid={heatmap.grid} dayNames={heatmap.dayNames} />
        </CardContent>
      </Card>
    </div>
  );
}
