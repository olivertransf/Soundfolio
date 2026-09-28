type ChartPoint = {
  label: string;
  minutes: number;
  streams: number;
};

export function BarSeriesChart({
  points,
  metric,
  label,
}: {
  points: ChartPoint[];
  metric: "minutes" | "streams";
  label: string;
}) {
  const values = points.map((point) => (metric === "minutes" ? point.minutes : point.streams));
  const max = Math.max(1, ...values);
  const width = 640;
  const height = 140;
  const gap = points.length > 60 ? 1 : 2;
  const barWidth = Math.max(1, (width - gap * Math.max(points.length - 1, 0)) / Math.max(points.length, 1));

  if (points.length === 0) {
    return <p className="px-2 py-6 text-center text-sm text-muted-foreground">No plays in this range.</p>;
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-36 w-full"
      role="img"
      aria-label={label}
    >
      {values.map((value, index) => {
        const barHeight = Math.max(value > 0 ? 1 : 0, (value / max) * (height - 4));
        const x = index * (barWidth + gap);
        return (
          <rect
            key={`${points[index]?.label ?? index}`}
            x={x}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            className="fill-primary"
          >
            <title>
              {points[index]?.label}: {value.toLocaleString()} {metric === "minutes" ? "min" : "plays"}
            </title>
          </rect>
        );
      })}
    </svg>
  );
}
