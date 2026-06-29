import { safeJson } from "@/lib/safe-json";

const BASE = "https://ws.audioscrobbler.com/2.0/";

function lastFmApiKey() {
  return process.env.LASTFM_API_KEY?.trim() ?? "";
}

function lastFmUsername() {
  return process.env.LASTFM_USER?.trim() ?? "";
}

export function isLastFmConfigured() {
  return Boolean(lastFmApiKey() && lastFmUsername());
}

interface LastFmTrack {
  artist: { "#text": string };
  name: string;
  album?: { "#text": string };
  date?: { uts: string };
  image?: { "#text": string; size: string }[];
  "@attr"?: { nowplaying?: "true" };
}

interface LastFmResponse {
  recenttracks?: {
    track: LastFmTrack | LastFmTrack[];
    "@attr"?: { totalPages: string };
  };
  error?: number;
  message?: string;
}

const LASTFM_PAGE_SIZE = 200;
const LASTFM_MAX_PAGES = 30;

function parseRecentTracksPage(data: LastFmResponse | null) {
  if (!data || data.error) {
    throw new Error(data?.message ?? "Last.fm API error");
  }
  const raw = data.recenttracks?.track;
  if (!raw) return { tracks: [], totalPages: 1 };
  const tracks = Array.isArray(raw) ? raw : [raw];
  const totalPages = Math.max(
    1,
    parseInt(data.recenttracks?.["@attr"]?.totalPages ?? "1", 10) || 1
  );
  return {
    totalPages,
    tracks: tracks
      .filter((t) => t.date?.uts)
      .map((t) => mapTrack(t, new Date(parseInt(t.date!.uts, 10) * 1000))),
  };
}

async function fetchRecentTracksPage(
  username: string,
  page: number,
  fromTimestamp?: number,
  toTimestamp?: number
) {
  const apiKey = lastFmApiKey();
  if (!apiKey) return { tracks: [], totalPages: 1 };

  const params = new URLSearchParams({
    method: "user.getRecentTracks",
    user: username,
    api_key: apiKey,
    format: "json",
    limit: String(LASTFM_PAGE_SIZE),
    page: String(page),
  });
  if (fromTimestamp != null) params.set("from", String(fromTimestamp));
  if (toTimestamp != null) params.set("to", String(toTimestamp));

  const res = await fetch(`${BASE}?${params}`, { cache: "no-store" });
  const data = (await safeJson(res)) as LastFmResponse | null;
  if (!res.ok && !data?.error) {
    throw new Error(`Last.fm API HTTP ${res.status}`);
  }
  return parseRecentTracksPage(data);
}

/** All scrobbles after `fromTimestamp` (paginated). Required when catching up >200 plays. */
export async function getRecentTracks(
  username: string,
  limit = 50,
  fromTimestamp?: number
): Promise<{ artist: string; name: string; album: string; playedAt: Date; image: string | null }[]> {
  if (fromTimestamp == null) {
    const { tracks } = await fetchRecentTracksPage(username, 1);
    return tracks.slice(0, limit);
  }

  const cap = Math.min(LASTFM_MAX_PAGES, Math.ceil(limit / LASTFM_PAGE_SIZE) || LASTFM_MAX_PAGES);
  const merged: ReturnType<typeof mapTrack>[] = [];
  let totalPages = 1;

  for (let page = 1; page <= cap; page++) {
    const batch = await fetchRecentTracksPage(username, page, fromTimestamp);
    totalPages = batch.totalPages;
    merged.push(...batch.tracks);
    if (page >= totalPages || batch.tracks.length === 0) break;
  }

  const seen = new Set<number>();
  return merged.filter((t) => {
    const key = t.playedAt.getTime();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type LastFmImage = { size?: string; "#text"?: string };

export function isLastFmPlaceholderUrl(url: string): boolean {
  return url.includes(PLACEHOLDER_HASH);
}

/** Best album/track image from a Last.fm `image` array (skips empty placeholders). */
export function pickLastFmImageUrl(images: LastFmImage[] | undefined): string | null {
  const imgs = Array.isArray(images) ? images : [];
  const img =
    imgs.find((i) => i?.size === "extralarge" || i?.size === "large") ?? imgs[imgs.length - 1];
  const url = img?.["#text"];
  if (!url || url.length === 0 || isLastFmPlaceholderUrl(url)) return null;
  return url;
}

function mapTrack(t: LastFmTrack, playedAt: Date) {
  return {
    artist: (t.artist as { "#text"?: string })?.["#text"] ?? "Unknown",
    name: t.name ?? "Unknown",
    album: (t.album as { "#text"?: string })?.["#text"] ?? "",
    playedAt,
    image: pickLastFmImageUrl(t.image),
  };
}

export async function getNowPlayingTrack(
  username: string
): Promise<ReturnType<typeof mapTrack> | null> {
  const apiKey = lastFmApiKey();
  if (!apiKey) return null;
  const params = new URLSearchParams({
    method: "user.getRecentTracks",
    user: username,
    api_key: apiKey,
    format: "json",
    limit: "1",
  });

  const res = await fetch(`${BASE}?${params}`, { cache: "no-store" });
  const data = (await safeJson(res)) as LastFmResponse | null;
  if (!data || data.error) return null;
  const raw = data.recenttracks?.track;
  const [track] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (!track || track["@attr"]?.nowplaying !== "true") return null;
  return mapTrack(track, new Date());
}

type LastFmTrackInfo = {
  error?: number;
  track?: {
    duration?: string;
    album?: { image?: LastFmImage[] };
  };
};

type LastFmAlbumInfo = {
  error?: number;
  album?: { image?: LastFmImage[] };
};

async function fetchTrackInfo(artist: string, track: string): Promise<LastFmTrackInfo | null> {
  const apiKey = lastFmApiKey();
  if (!apiKey) return null;
  const params = new URLSearchParams({
    method: "track.getInfo",
    artist,
    track,
    api_key: apiKey,
    format: "json",
  });
  const res = await fetch(`${BASE}?${params}`);
  const data = (await safeJson(res)) as LastFmTrackInfo | null;
  if (!data || data.error) return null;
  return data;
}

/** Sanity bounds for catalog length (classical movements can be long; block bad metadata). */
export const LASTFM_MIN_CATALOG_MS = 30_000;
export const LASTFM_MAX_CATALOG_MS = 90 * 60 * 1000;

/** Duration from Last.fm catalog metadata (seconds → ms), not listen time. */
export async function getTrackDurationMs(
  artist: string,
  track: string
): Promise<number | null> {
  const data = await fetchTrackInfo(artist, track);
  const raw = data?.track?.duration;
  if (raw == null || raw === "") return null;
  const n = parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Last.fm uses seconds; very large values are sometimes ms mislabeled.
  const ms = n > 7200 ? n : n * 1000;
  return normalizeCatalogDurationMs(ms);
}

export function normalizeCatalogDurationMs(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return lastFmDefaultDurationMs();
  return Math.min(Math.max(ms, LASTFM_MIN_CATALOG_MS), LASTFM_MAX_CATALOG_MS);
}

/** Catalog track length for a scrobble (cached per artist + track). */
export async function resolveLastFmCatalogDurationMs(
  artist: string,
  track: string,
  cache: Map<string, number>
): Promise<number> {
  const key = `${artist}\0${track}`;
  const hit = cache.get(key);
  if (hit != null) return hit;

  const fromApi = await getTrackDurationMs(artist, track);
  const ms = normalizeCatalogDurationMs(fromApi ?? lastFmDefaultDurationMs());
  cache.set(key, ms);
  return ms;
}

export async function getTrackArt(artist: string, track: string): Promise<string | null> {
  const data = await fetchTrackInfo(artist, track);
  if (!data) return null;
  return pickLastFmImageUrl(data.track?.album?.image);
}

export async function getAlbumArt(artist: string, album: string): Promise<string | null> {
  const apiKey = lastFmApiKey();
  if (!apiKey || !album.trim()) return null;
  const params = new URLSearchParams({
    method: "album.getInfo",
    artist,
    album,
    api_key: apiKey,
    format: "json",
  });
  const res = await fetch(`${BASE}?${params}`);
  const data = (await safeJson(res)) as LastFmAlbumInfo | null;
  if (!data || data.error) return null;
  return pickLastFmImageUrl(data.album?.image);
}

/** Fallback when Last.fm has no catalog duration for a track. */
export function lastFmDefaultDurationMs(): number {
  const raw = process.env.LASTFM_DEFAULT_DURATION_MS?.trim();
  if (raw) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return normalizeCatalogDurationMs(n);
  }
  return 180_000;
}

const PLACEHOLDER_HASH = "2a96cbd8b46e442fc41c2b86b821562f";

export async function getArtistArt(artist: string): Promise<string | null> {
  const apiKey = lastFmApiKey();
  if (!apiKey) return null;
  const params = new URLSearchParams({
    method: "artist.getInfo",
    artist,
    api_key: apiKey,
    format: "json",
  });
  const res = await fetch(`${BASE}?${params}`);
  const data = (await safeJson(res)) as {
    error?: number;
    artist?: { image?: LastFmImage[] };
  } | null;
  if (!data || data.error) return null;
  return pickLastFmImageUrl(data.artist?.image);
}
