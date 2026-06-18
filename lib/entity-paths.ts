export function trackPath(artistName: string, trackName: string) {
  return `/track/${encodeURIComponent(artistName)}/${encodeURIComponent(trackName)}`;
}

export function artistPath(artistName: string) {
  return `/artist/${encodeURIComponent(artistName)}`;
}

export function albumPath(artistName: string, albumName: string) {
  return `/album/${encodeURIComponent(artistName)}/${encodeURIComponent(albumName)}`;
}

export function libraryPath(section: "recent" | "rankings" | "patterns" = "recent", statsQuery = "") {
  const params = new URLSearchParams(statsQuery.replace(/^\?/, ""));
  params.set("section", section);
  const query = params.toString();
  return query ? `/library?${query}` : `/library?section=${section}`;
}
