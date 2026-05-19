export type TopSortBy = "minutes" | "streams";

export const TOP_SORT_PARAM = "sort";

export function parseTopSortBy(value: string | null | undefined): TopSortBy {
  return value === "streams" ? "streams" : "minutes";
}

export function topSortLabel(sortBy: TopSortBy): string {
  return sortBy === "streams" ? "play count" : "listening time";
}
