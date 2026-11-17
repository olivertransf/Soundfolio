const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type HeatCell = {
  day: number;
  hour: number;
  minutes: number;
};

export function WeekHeatmap({
  grid,
  peakDay,
  peakHour,
}: {
  grid: HeatCell[];
  peakDay?: string | null;
  peakHour?: string | null;
}) {
  const max = Math.max(1, ...grid.map((cell) => cell.minutes));
  const minutes = new Map(grid.map((cell) => [`${cell.day}-${cell.hour}`, cell.minutes]));
  const peak = [peakDay, peakHour].filter(Boolean).join(" · ");

  return (
    <section className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-3" aria-label="Week and hour">
      {peak ? <p className="text-sm font-medium tracking-tight">{peak}</p> : null}
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[40rem] gap-px"
          style={{ gridTemplateColumns: "2.25rem repeat(24, minmax(0, 1fr))" }}
        >
          <span />
          {Array.from({ length: 24 }, (_, hour) => (
            <span key={hour} className="truncate text-center text-[10px] text-muted-foreground">
              {hour % 3 === 0 ? String(hour).padStart(2, "0") : ""}
            </span>
          ))}
          {DAY_ORDER.map((day) => (
            <div key={day} className="contents">
              <span className="self-center text-[10px] text-muted-foreground">{DAY_NAMES[day]}</span>
              {Array.from({ length: 24 }, (_, hour) => {
                const value = minutes.get(`${day}-${hour}`) ?? 0;
                return (
                  <span
                    key={hour}
                    title={`${DAY_NAMES[day]} ${String(hour).padStart(2, "0")}:00 · ${value.toLocaleString()}m`}
                    className="aspect-square rounded-[2px]"
                    style={{
                      backgroundColor: `color-mix(in srgb, var(--primary) ${value ? 14 + (86 * value) / max : 8}%, var(--secondary))`,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
