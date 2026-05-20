import { safeJson } from "@/lib/safe-json";

type ItunesResult = {
  artistName?: string;
  trackName?: string;
  collectionName?: string;
  artworkUrl600?: string;
  artworkUrl100?: string;
  artworkUrl60?: string;
};

function pickItunesArtwork(match: ItunesResult): string | null {
  return match.artworkUrl600 ?? match.artworkUrl100 ?? match.artworkUrl60 ?? null;
}

function itunesTrackNameCandidates(trackName: string): string[] {
  const raw = trackName.trim();
  const out: string[] = [];
  const add = (s: string) => {
    const t = s.trim();
    if (t && !out.includes(t)) out.push(t);
  };
  add(raw);
  add(raw.replace(/\s*-\s*\d{4}\s+remaster(ed)?/i, ""));
  add(raw.replace(/\s*-\s*remaster(ed)?(\s+\d{4})?/i, ""));
  const base = raw.split(/\s+-\s+/)[0];
  add(base);
  return out;
}

async function searchSongOnItunes(
  artistName: string,
  trackName: string
): Promise<string | null> {
  const term = `${artistName.trim()} ${trackName.trim()}`;
  const res = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=8`
  );
  if (!res.ok) return null;
  const data = (await safeJson(res)) as { results?: ItunesResult[] } | null;
  if (!data?.results?.length) return null;

  const artistLower = artistName.trim().toLowerCase();
  const trackLower = trackName.trim().toLowerCase();
  const match =
    data.results.find(
      (r) =>
        r.artistName?.toLowerCase().includes(artistLower) &&
        r.trackName?.toLowerCase().includes(trackLower)
    ) ??
    data.results.find((r) => r.artistName?.toLowerCase().includes(artistLower)) ??
    data.results[0];

  return match ? pickItunesArtwork(match) : null;
}

/** Song search — useful when album search fails (compilations, Broadway, remasters). */
export async function getSongArtFromItunes(
  artistName: string,
  trackName: string
): Promise<string | null> {
  if (!artistName?.trim() || !trackName?.trim()) return null;
  for (const candidate of itunesTrackNameCandidates(trackName)) {
    const art = await searchSongOnItunes(artistName, candidate);
    if (art) return art;
  }
  return null;
}

export async function getAlbumArtFromItunes(
  artistName: string,
  albumName: string
): Promise<string | null> {
  if (!artistName?.trim() || !albumName?.trim()) return null;
  const term = `${artistName.trim()} ${albumName.trim()}`;
  const res = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=album&limit=3`
  );
  if (!res.ok) return null;
  const data = (await safeJson(res)) as { results?: ItunesResult[] } | null;
  if (!data?.results?.length) return null;
  const artistLower = artistName.trim().toLowerCase();
  const albumLower = albumName.trim().toLowerCase();
  const match =
    data.results.find(
      (r) =>
        r.artistName?.toLowerCase().includes(artistLower) &&
        r.collectionName?.toLowerCase().includes(albumLower)
    ) ?? data.results[0];
  return match ? pickItunesArtwork(match) : null;
}
