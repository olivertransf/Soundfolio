export function normalizeEntityKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function cleanEntityLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Stable catalog id (Spotify, lfm-track-*, etc.) — not per-scrobble lfm-* stream ids. */
export function isCatalogTrackId(trackId: string): boolean {
  const id = trackId.trim();
  if (!id) return false;
  if (id.startsWith("lfm-") && !id.startsWith("lfm-track-")) return false;
  return true;
}

export function matchesEntity(a: string, b: string): boolean {
  return normalizeEntityKey(a) === normalizeEntityKey(b);
}

/** Prefer title-cased / longer spellings when merging rows for the same entity. */
export function pickBetterDisplayName(current: string, candidate: string): string {
  const left = cleanEntityLabel(current);
  const right = cleanEntityLabel(candidate);
  if (!left) return right;
  if (!right) return left;
  if (normalizeEntityKey(left) !== normalizeEntityKey(right)) return left;

  const score = (value: string) => {
    const words = value.split(" ");
    const titled = words.filter((word) => /^[A-Z]/.test(word)).length;
    return titled * 10 + value.length;
  };

  return score(right) > score(left) ? right : left;
}

export function trackGroupKey(trackId: string, trackName: string, artistName: string): string {
  if (isCatalogTrackId(trackId)) return `id:${trackId.trim().toLocaleLowerCase()}`;
  return `name:${normalizeEntityKey(trackName)}\0${normalizeEntityKey(artistName)}`;
}

export function catalogTrackId(trackId: string, trackName: string, artistName: string): string {
  if (isCatalogTrackId(trackId)) return trackId.trim();
  return trackGroupKey("", trackName, artistName);
}

export function albumGroupKey(albumName: string, artistName: string): string {
  return `${normalizeEntityKey(albumName)}\0${normalizeEntityKey(artistName)}`;
}

export function artistGroupKey(artistName: string): string {
  return normalizeEntityKey(artistName);
}
