import { DEFAULT_TIME_RANGE } from "@/lib/time-range";

export const STATS_TIME_FILTER_KEY = "soundfolio:stats-time-filter";
export const STATS_GROUP_BY_KEY = "soundfolio:chart-group-by";
export const STATS_TOP_SORT_KEY = "soundfolio:top-sort";

export type TopSortPreference = "minutes" | "streams";

export type GroupByPreference = "days" | "weeks" | "months";

export type StoredTimeFilter =
  | { kind: "preset"; range: string }
  | { kind: "custom"; from: string; to: string };

export function parseStoredTimeFilter(raw: string | null): StoredTimeFilter | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return null;
    const o = j as Record<string, unknown>;
    if (o.kind === "preset" && typeof o.range === "string")
      return { kind: "preset", range: o.range };
    if (
      o.kind === "custom" &&
      typeof o.from === "string" &&
      typeof o.to === "string"
    )
      return { kind: "custom", from: o.from, to: o.to };
  } catch {
    // ignore invalid JSON
  }
  return null;
}

export function storedTimeFilterToQueryString(f: StoredTimeFilter): string {
  const p = new URLSearchParams();
  if (f.kind === "preset") p.set("range", f.range);
  else {
    p.set("from", f.from);
    p.set("to", f.to);
  }
  return p.toString();
}

export function getStoredTimeFilter(): StoredTimeFilter | null {
  if (typeof window === "undefined") return null;
  return parseStoredTimeFilter(localStorage.getItem(STATS_TIME_FILTER_KEY));
}

export function setStoredTimeFilter(f: StoredTimeFilter): void {
  try {
    localStorage.setItem(STATS_TIME_FILTER_KEY, JSON.stringify(f));
  } catch {
    // storage full / disabled
  }
}

export function defaultStatsNavQuery(): string {
  return new URLSearchParams({ range: DEFAULT_TIME_RANGE }).toString();
}

export function statsQueryFromStoredFilter(f: StoredTimeFilter | null): string {
  if (!f) return defaultStatsNavQuery();
  return storedTimeFilterToQueryString(f);
}

export function getStoredGroupBy(): GroupByPreference {
  if (typeof window === "undefined") return "weeks";
  try {
    const v = localStorage.getItem(STATS_GROUP_BY_KEY);
    if (v === "days" || v === "weeks" || v === "months") return v;
  } catch {
    // ignore
  }
  return "weeks";
}

export function setStoredGroupBy(v: GroupByPreference): void {
  try {
    localStorage.setItem(STATS_GROUP_BY_KEY, v);
  } catch {
    // ignore
  }
}

export function getStoredTopSort(): TopSortPreference {
  if (typeof window === "undefined") return "minutes";
  try {
    const v = localStorage.getItem(STATS_TOP_SORT_KEY);
    if (v === "minutes" || v === "streams") return v;
  } catch {
    // ignore
  }
  return "minutes";
}

export function setStoredTopSort(v: TopSortPreference): void {
  try {
    localStorage.setItem(STATS_TOP_SORT_KEY, v);
  } catch {
    // ignore
  }
}
