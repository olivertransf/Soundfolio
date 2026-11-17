import Link from "next/link";
import type { ChartPoint } from "@/components/bar-series-chart";
import { NumberChart, countDetail, extraStatItems } from "@/components/visual/stat-grid";

const SLICE_COLORS = [
  "var(--primary)",
  "#38bdf8",
  "#f59e0b",
  "#fb7185",
  "#a78bfa",
  "#2dd4bf",
  "#f97316",
  "#e4e4e7",
];

export function DonutChart({ points }: { points: ChartPoint[] }) {
  const slices = points.filter((point) => point.minutes > 0);
  const total = slices.reduce((sum, point) => sum + point.minutes, 0);
  const size = 176;
  const stroke = 26;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let drawn = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <svg viewBox={`0 0 ${size} ${size}`} className="size-44 shrink-0 -rotate-90" role="img" aria-label="Share of minutes">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--secondary)"
          strokeWidth={stroke}
        />
        {total > 0
          ? slices.map((point, index) => {
              const length = (point.minutes / total) * circumference;
              const dash = `${length} ${circumference - length}`;
              const offset = drawn;
              drawn += length;
              return (
                <circle
                  key={point.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={SLICE_COLORS[index % SLICE_COLORS.length]}
                  strokeWidth={stroke}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                >
                  <title>
                    {point.label}: {point.minutes.toLocaleString()} min · {point.streams.toLocaleString()} plays
                  </title>
                </circle>
              );
            })
          : null}
      </svg>
      <ul className="min-w-0 flex-1 space-y-2">
        {slices.map((point, index) => {
          const share = total > 0 ? Math.round((point.minutes / total) * 100) : 0;
          return (
            <li key={point.label} className="flex items-start gap-2">
              <span
                className="mt-1 size-2.5 shrink-0 rounded-full"
                style={{ background: SLICE_COLORS[index % SLICE_COLORS.length] }}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{point.label}</span>
                <span className="block text-[11px] tabular-nums text-muted-foreground">
                  {share}% · {point.minutes.toLocaleString()} min · {point.streams.toLocaleString()} plays
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function RankBars({
  items,
}: {
  items: { key: string; label: string; hint?: string; minutes: number; plays: number; href?: string }[];
}) {
  const max = Math.max(1, ...items.map((item) => item.minutes));
  return (
    <ol className="space-y-3">
      {items.map((item, index) => {
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-medium">
                <span className="mr-1.5 tabular-nums text-muted-foreground">{index + 1}</span>
                {item.label}
              </p>
              <p className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {item.minutes.toLocaleString()} min · {item.plays.toLocaleString()} plays
              </p>
            </div>
            {item.hint ? <p className="truncate text-[11px] text-muted-foreground">{item.hint}</p> : null}
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(item.minutes / max) * 100}%` }} />
            </div>
          </>
        );
        return (
          <li key={item.key}>
            {item.href ? (
              <Link href={item.href} className="block rounded-md outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-primary">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function quietPoint(points: ChartPoint[]) {
  const active = points.filter((point) => point.minutes > 0);
  if (active.length === 0) return null;
  return active.reduce((best, point) => (point.minutes < best.minutes ? point : best));
}

export function withRestPlays(points: ChartPoint[], totalPlays: number): ChartPoint[] {
  const namedPlays = points
    .filter((point) => point.label !== "Rest")
    .reduce((sum, point) => sum + point.streams, 0);
  return points.map((point) =>
    point.label === "Rest" ? { ...point, streams: Math.max(0, totalPlays - namedPlays) } : point
  );
}

function peakLine(points: ChartPoint[]) {
  const peak = points.reduce<ChartPoint | null>(
    (best, point) => (point.minutes > (best?.minutes ?? -1) ? point : best),
    null
  );
  if (!peak || peak.minutes <= 0) return undefined;
  return `${peak.label} · ${countDetail(peak.minutes, peak.streams)}`;
}

export function ListeningMix({
  dayparts,
  weekParts,
  replays,
  artists,
  topTen,
}: {
  dayparts: ChartPoint[];
  weekParts: ChartPoint[];
  replays: ChartPoint[];
  artists: ChartPoint[];
  topTen: ChartPoint[];
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <NumberChart title="Parts of the day" detail={peakLine(dayparts)}>
        <DonutChart points={dayparts} />
      </NumberChart>
      <NumberChart title="Week or weekend" detail={peakLine(weekParts)}>
        <DonutChart points={weekParts} />
      </NumberChart>
      <NumberChart title="Heard once or again" detail={peakLine(replays)}>
        <DonutChart points={replays} />
      </NumberChart>
      <NumberChart title="Top artists" detail={peakLine(artists)}>
        <DonutChart points={artists} />
      </NumberChart>
      <NumberChart title="Top 10 tracks" detail={peakLine(topTen)}>
        <DonutChart points={topTen} />
      </NumberChart>
    </div>
  );
}

export function patternStats({
  minutes,
  plays,
  tracks,
  artists,
  albums,
  breakdown,
  hours,
  weekdays,
  hourLabel,
}: {
  minutes: number;
  plays: number;
  tracks?: number;
  artists?: number;
  albums?: number;
  breakdown: {
    activeDays: number;
    dayparts: ChartPoint[];
    weekParts: ChartPoint[];
    replays: ChartPoint[];
    onceTracks: number;
    replayTracks: number;
    longestPlayMinutes: number;
    artistShare: ChartPoint[];
  };
  hours: ChartPoint[];
  weekdays: ChartPoint[];
  hourLabel: (label: string) => string;
}) {
  const quietHourPoint = quietPoint(hours);
  const quietWeekday = quietPoint(weekdays);
  const replay = breakdown.replays[1];
  return extraStatItems({
    minutes,
    plays,
    tracks,
    artists,
    albums,
    activeDays: breakdown.activeDays,
    dayparts: breakdown.dayparts,
    weekParts: breakdown.weekParts,
    topArtist: breakdown.artistShare.find((artist) => artist.label !== "Rest") ?? null,
    onceTracks: breakdown.onceTracks,
    replayTracks: breakdown.replayTracks,
    replayMinutes: replay?.minutes,
    replayPlays: replay?.streams,
    longestPlayMinutes: breakdown.longestPlayMinutes,
    quietDay: quietWeekday?.label,
    quietMinutes: quietWeekday?.minutes,
    quietPlays: quietWeekday?.streams,
    quietHour: quietHourPoint ? hourLabel(quietHourPoint.label) : null,
    quietHourDetail: quietHourPoint ? countDetail(quietHourPoint.minutes, quietHourPoint.streams) : null,
  });
}
