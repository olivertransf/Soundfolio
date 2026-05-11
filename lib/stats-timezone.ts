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
