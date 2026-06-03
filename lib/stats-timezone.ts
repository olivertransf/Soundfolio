/**
 * Bucketing for “time of day” / “day of week” stats.
 * Node’s default is often UTC in production; use TIMEZONE so hours match where you listen.
 */

export const VIEWER_TIMEZONE_COOKIE = "soundfolio_tz";
export const VIEWER_TIMEZONE_PARAM = "tz";

export function isValidTimeZone(value: string | null | undefined): value is string {
  if (!value) return false;
  const zone = value.trim();
  if (!zone) return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: zone }).format();
    return true;
  } catch {
    return false;
  }
}

export function getStatsTimeZone(): string {
  const fromEnv = process.env.TIMEZONE?.trim() || process.env.SOUNDFOLIO_TIMEZONE?.trim();
  if (isValidTimeZone(fromEnv)) return fromEnv;
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (isValidTimeZone(detected)) return detected;
    return "UTC";
  } catch {
    return "UTC";
  }
}

export function resolveStatsTimeZone(preferredTimeZone?: string | null): string {
  if (isValidTimeZone(preferredTimeZone)) return preferredTimeZone;
  return getStatsTimeZone();
}

/**
 * Spotify ZIP `ts` values have no offset; parse them as wall time in the listener zone.
 * Use when importing new history (not for rows already stored as UTC instants).
 */
export function spotifyExportTsToUtc(ts: string, timeZone: string): Date {
  const s = String(ts).trim();
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return new Date(n > 1e12 ? n : n * 1000);
  }
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(s)) {
    return new Date(s);
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/);
  if (m) {
    const base = zonedDateTimeToUtc(
      timeZone,
      Number(m[1]),
      Number(m[2]),
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6])
    );
    const ms = m[7] ? Number(m[7].padEnd(3, "0").slice(0, 3)) : 0;
    return new Date(base.getTime() + ms);
  }
  return new Date(s);
}

/** Spotify ZIP imports often land at fake night / afternoon hours when local wall time was stored as UTC. */
function spotifyImportLooksMisParsed(playedAt: Date, timeZone: string): boolean {
  const h = getHourInTimeZone(playedAt, timeZone);
  return h <= 6 || (h >= 14 && h <= 16);
}

/**
 * Some clients store the listener's wall clock (hour/minute) as a UTC instant.
 * Rebuild the real instant by reading those digits in `timeZone` instead.
 */
export function fixWallTimeStoredAsUtc(playedAt: Date, timeZone: string): Date {
  const y = playedAt.getUTCFullYear();
  const month = playedAt.getUTCMonth() + 1;
  const day = playedAt.getUTCDate();
  const hour = playedAt.getUTCHours();
  const minute = playedAt.getUTCMinutes();
  const second = playedAt.getUTCSeconds();
  const ms = playedAt.getUTCMilliseconds();
  const base = zonedDateTimeToUtc(timeZone, y, month, day, hour, minute, second);
  return new Date(base.getTime() + ms);
}

/** @deprecated Use {@link fixWallTimeStoredAsUtc}. */
export const fixSpotifyImportPlayedAt = fixWallTimeStoredAsUtc;

/**
 * Last.fm scrobbles that used local wall digits as UTC show up as ~2–6 AM Pacific
 * when the listen was actually daytime / evening.
 */
export function lastFmLooksWallTimeAsUtc(playedAt: Date, timeZone: string): boolean {
  const h = getHourInTimeZone(playedAt, timeZone);
  // Real midnight listens are hour 0–1; ghost plays from wall-as-UTC land around 2–6 AM.
  return h >= 2 && h <= 6;
}

export function correctLastFmPlayedAt(playedAt: Date, timeZone: string): Date {
  if (!lastFmLooksWallTimeAsUtc(playedAt, timeZone)) return playedAt;
  return fixWallTimeStoredAsUtc(playedAt, timeZone);
}

/**
 * When to bucket a play in hour-of-day / heatmap charts.
 * Last.fm and Spotify ZIP import use end-of-play timestamps; Spotify sync uses start.
 */
export function getListenBucketInstant(
  playedAt: Date,
  durationMs: number,
  trackId: string,
  timeZone: string
): Date {
  let anchor = playedAt;
  if (trackId.startsWith("lfm-")) {
    anchor = correctLastFmPlayedAt(playedAt, timeZone);
    return new Date(anchor.getTime() - Math.max(0, durationMs));
  }

  if (
    playedAt.getUTCMilliseconds() === 0 &&
    spotifyImportLooksMisParsed(playedAt, timeZone)
  ) {
    anchor = fixWallTimeStoredAsUtc(playedAt, timeZone);
  }

  // Spotify recently-played API: `played_at` is start; `duration_ms` is full track length.
  if (durationMs >= 120_000 && durationMs % 1000 === 0) {
    return anchor;
  }
  // Spotify extended history import: `ts` is end, `ms_played` is actual listen time.
  return new Date(anchor.getTime() - Math.max(0, durationMs));
}

/** Hour 0–23 in `timeZone` (same instant as `date`). */
export function getHourInTimeZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const hourPart = parts.find((p) => p.type === "hour");
  return hourPart ? parseInt(hourPart.value, 10) : 0;
}

/** 0 = Sunday … 6 = Saturday in `timeZone` (matches JS `Date#getDay`). */
export function getDayOfWeekInTimeZone(date: Date, timeZone: string): number {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[wd] ?? 0;
}

/** Calendar date `yyyy-MM-dd` in `timeZone` for bucketing daily charts. */
export function formatCalendarDateInZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function getOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );
  return asUtc - date.getTime();
}

export function zonedDateTimeToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  const offset = getOffsetMs(utcGuess, timeZone);
  const firstPass = new Date(utcGuess.getTime() - offset);
  const correctedOffset = getOffsetMs(firstPass, timeZone);
  return new Date(utcGuess.getTime() - correctedOffset);
}

export function startOfCalendarDateInZone(date: string, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return zonedDateTimeToUtc(timeZone, year, month, day);
}

export function endOfCalendarDateInZone(date: string, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return zonedDateTimeToUtc(timeZone, year, month, day, 23, 59, 59, 999);
}

export function startOfYearInZone(now: Date, timeZone: string): Date {
  const year = Number(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric" }).format(now)
  );
  return zonedDateTimeToUtc(timeZone, year, 1, 1);
}

/** Move a calendar date (yyyy-MM-dd in `timeZone`) by `deltaDays`. */
export function addCalendarDaysInZone(
  dateStr: string,
  deltaDays: number,
  timeZone: string
): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const noon = zonedDateTimeToUtc(timeZone, year, month, day, 12);
  const shifted = new Date(noon.getTime() + deltaDays * 86_400_000);
  return formatCalendarDateInZone(shifted, timeZone);
}

/** Inclusive calendar-day span between two yyyy-MM-dd strings in `timeZone`. */
export function calendarDaysBetweenInZone(from: string, to: string, timeZone: string): number {
  const start = startOfCalendarDateInZone(from, timeZone).getTime();
  const end = startOfCalendarDateInZone(to, timeZone).getTime();
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

export type ChartDateLabelKind = "month" | "week" | "day" | "hour" | "weekday";

function formatInstantInZone(instant: Date, timeZone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { timeZone, ...options }).format(instant);
}

/** Format a bucket label for charts (labels are calendar buckets in `timeZone`). */
export function formatChartAxisLabel(
  value: string,
  kind: ChartDateLabelKind,
  timeZone: string
): string {
  if (kind === "hour") return value.includes(":") ? value.replace(":00", "h") : value;
  if (kind === "weekday") return value;

  if (kind === "month" && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split("-").map(Number);
    const instant = zonedDateTimeToUtc(timeZone, y, m, 1, 12);
    return formatInstantInZone(instant, timeZone, { month: "short", year: "2-digit" });
  }

  if ((kind === "week" || kind === "day") && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    const instant = zonedDateTimeToUtc(timeZone, y, m, d, 12);
    return formatInstantInZone(instant, timeZone, { month: "short", day: "numeric" });
  }

  return value;
}

export function formatChartTooltipLabel(
  value: string,
  kind: ChartDateLabelKind,
  timeZone: string
): string {
  if (kind === "hour") return `Hour starting ${value}`;
  if (kind === "weekday") return value;

  if (kind === "month" && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split("-").map(Number);
    const instant = zonedDateTimeToUtc(timeZone, y, m, 1, 12);
    return formatInstantInZone(instant, timeZone, { month: "long", year: "numeric" });
  }

  if ((kind === "week" || kind === "day") && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    const instant = zonedDateTimeToUtc(timeZone, y, m, d, 12);
    const formatted = formatInstantInZone(instant, timeZone, {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return kind === "week" ? `Week of ${formatted}` : formatted;
  }

  return value;
}

/** Human-readable calendar range for filters (yyyy-MM-dd bounds in `timeZone`). */
export function formatCalendarRangeLabel(from: string, to: string, timeZone: string): string {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  const start = zonedDateTimeToUtc(timeZone, y1, m1, d1, 12);
  const end = zonedDateTimeToUtc(timeZone, y2, m2, d2, 12);
  const a = formatInstantInZone(start, timeZone, { month: "short", day: "numeric", year: "numeric" });
  const b = formatInstantInZone(end, timeZone, { month: "short", day: "numeric", year: "numeric" });
  return `${a} – ${b}`;
}
