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

const ALBUM_EDITION =
  /(?:\s*[(\[][^()[\]]*(?:remaster(?:ed)?|deluxe|expanded|anniversary|bonus|original motion picture soundtrack|music from the motion picture|original soundtrack(?: recording)?|soundtrack from and inspired by[^()\]]*)[^()[\]]*[)\]])+/gi;

/** Album title with edition and soundtrack suffixes removed, quotes folded, punctuation dropped. */
export function albumReleaseKey(albumName: string): string {
  return stripAlbumPunctuation(stripAlbumEdition(albumName));
}

export function sameAlbum(a: string, b: string): boolean {
  const left = albumReleaseKey(a);
  const right = albumReleaseKey(b);
  return left.length > 0 && left === right;
}

/** Prefer the unsuffixed title when two names are the same release. */
export function preferAlbumTitle(current: string, candidate: string): string {
  const left = cleanEntityLabel(current);
  const right = cleanEntityLabel(candidate);
  if (!left) return right;
  if (!right) return left;
  if (albumReleaseKey(left) !== albumReleaseKey(right)) return left;
  const leftPlain = isPlainAlbumTitle(left);
  const rightPlain = isPlainAlbumTitle(right);
  if (leftPlain !== rightPlain) return rightPlain ? right : left;
  return displayScore(right) > displayScore(left) ? right : left;
}

export function albumGroupKey(albumName: string, artistName: string): string {
  return `${albumReleaseKey(albumName)}\0${artistGroupKey(artistName)}`;
}

function stripAlbumEdition(albumName: string): string {
  let value = foldAlbumText(albumName);
  let previous = "";
  while (value !== previous) {
    previous = value;
    ALBUM_EDITION.lastIndex = 0;
    value = value.replace(ALBUM_EDITION, " ").replace(/\s+/g, " ").trim();
  }
  return value;
}

function isPlainAlbumTitle(albumName: string): boolean {
  return foldAlbumText(albumName) === stripAlbumEdition(albumName);
}

function foldAlbumText(albumName: string): string {
  return albumName
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-US")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐‑–—]/g, "-");
}

function stripAlbumPunctuation(albumName: string): string {
  return albumName
    .replace(/[^\p{L}\p{N}\p{M}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function displayScore(value: string): number {
  const titled = value.split(" ").filter((word) => /^[A-Z]/.test(word)).length;
  return titled * 10 + value.length;
}

export function artistGroupKey(artistName: string): string {
  return normalizeEntityKey(artistName);
}
