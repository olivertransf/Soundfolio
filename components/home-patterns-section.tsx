import {
  getStreamsByHour,
  getStreamsByDayOfWeek,
  getListeningHeatmap,
  type TimeRangeFilter,
} from "@/lib/stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListeningChart } from "@/components/listening-chart";
import { ListeningHeatmap } from "@/components/listening-heatmap";

const CHART_H = 200;

const panelTitle = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const cardShell =
  "overflow-hidden rounded-2xl border border-border/40 bg-card/40 shadow-none ring-0";
const cardHeaderPad = "border-b border-border/30 px-4 py-3";
const cardContentPad = "px-4 pb-4 pt-3";

export async function HomePatternsSection({
  filter,
  viewerTimeZone,
}: {
  filter: TimeRangeFilter;
  viewerTimeZone?: string | null;
}) {
  const tz = viewerTimeZone ?? undefined;
  const [byHour, byDay, heatmap] = await Promise.all([
    getStreamsByHour(filter, "me", tz),
    getStreamsByDayOfWeek(filter, "me", tz),
    getListeningHeatmap(filter, "me", tz),
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

  const peakHour =
    byHour.length > 0 ? byHour.reduce((a, b) => (a.minutes >= b.minutes ? a : b)) : null;
  const peakDay =
    byDay.length > 0 ? byDay.reduce((a, b) => (a.minutes >= b.minutes ? a : b)) : null;

  return (
    <section
      id="patterns"
      className="scroll-mt-28 space-y-4"
      aria-labelledby="home-patterns-heading"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <h2
          id="home-patterns-heading"
          className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
        >
          Listening patterns
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          Same period as your overview: when you listen and how it spreads across the week.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div className={`rounded-2xl border border-border/40 bg-card/40 ${cardContentPad}`}>
          <p className={panelTitle}>Busiest hour</p>
          <p className="mt-2 font-display text-xl font-semibold tabular-nums tracking-tight text-foreground">
            {peakHour ? peakHour.label : "—"}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {peakHour
              ? `${peakHour.minutes.toLocaleString()} minutes · ${peakHour.streams.toLocaleString()} streams`
              : "No plays in this range."}
          </p>
        </div>
        <div className={`rounded-2xl border border-border/40 bg-card/40 ${cardContentPad}`}>
          <p className={panelTitle}>Busiest day</p>
          <p className="mt-2 font-display text-xl font-semibold tracking-tight text-foreground">
            {peakDay ? peakDay.label : "—"}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {peakDay
              ? `${peakDay.minutes.toLocaleString()} minutes · ${peakDay.streams.toLocaleString()} streams`
              : "No plays in this range."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={cardShell}>
          <CardHeader className={`space-y-0 ${cardHeaderPad}`}>
            <CardTitle className={panelTitle}>By hour of day</CardTitle>
          </CardHeader>
          <CardContent className={cardContentPad}>
            <ListeningChart data={hourChartData} xAxis="hour" metric="both" height={CHART_H} />
          </CardContent>
        </Card>
        <Card className={cardShell}>
          <CardHeader className={`space-y-0 ${cardHeaderPad}`}>
            <CardTitle className={panelTitle}>By weekday</CardTitle>
          </CardHeader>
          <CardContent className={cardContentPad}>
            <ListeningChart data={dayChartData} xAxis="weekday" metric="both" height={CHART_H} />
          </CardContent>
        </Card>
      </div>

      <Card className={cardShell}>
        <CardHeader className={`space-y-0 ${cardHeaderPad}`}>
          <CardTitle className={panelTitle}>Week × hour</CardTitle>
        </CardHeader>
        <CardContent className={`overflow-x-auto ${cardContentPad}`}>
          <ListeningHeatmap grid={heatmap.grid} dayNames={heatmap.dayNames} />
        </CardContent>
      </Card>
    </section>
  );
}
