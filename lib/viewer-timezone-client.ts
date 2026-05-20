import {
  VIEWER_TIMEZONE_COOKIE,
  VIEWER_TIMEZONE_PARAM,
  isValidTimeZone,
} from "@/lib/stats-timezone";

export function readViewerTimeZoneCookie(): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${VIEWER_TIMEZONE_COOKIE}=`;
  const hit = document.cookie.split(";").find((c) => c.trim().startsWith(prefix));
  if (!hit) return null;
  const raw = hit.trim().slice(prefix.length);
  try {
    const tz = decodeURIComponent(raw);
    return isValidTimeZone(tz) ? tz : null;
  } catch {
    return null;
  }
}

export function detectViewerTimeZone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(tz) ? tz : null;
  } catch {
    return null;
  }
}

/** Persist browser timezone for server-side bucketing (charts, patterns, filters). */
export function syncViewerTimeZoneCookie(options?: { updateUrl?: boolean }): string | null {
  const tz = detectViewerTimeZone();
  if (!tz) return null;

  const previous = readViewerTimeZoneCookie();
  document.cookie = `${VIEWER_TIMEZONE_COOKIE}=${encodeURIComponent(
    tz
  )}; Max-Age=31536000; Path=/; SameSite=Lax`;

  if (options?.updateUrl !== false && typeof window !== "undefined") {
    const url = new URL(window.location.href);
    if (url.searchParams.get(VIEWER_TIMEZONE_PARAM) !== tz) {
      url.searchParams.set(VIEWER_TIMEZONE_PARAM, tz);
      window.history.replaceState({}, "", url);
    }
  }

  return previous !== tz ? tz : null;
}
