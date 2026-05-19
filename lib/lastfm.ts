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

export async function getRecentTracks(
  username: string,
  limit = 50,
  fromTimestamp?: number
): Promise<{ artist: string; name: string; album: string; playedAt: Date; image: string | null }[]> {
  const apiKey = lastFmApiKey();
  if (!apiKey) return [];

  const params = new URLSearchParams({
    method: "user.getRecentTracks",
    user: username,
    api_key: apiKey,
    format: "json",
    limit: String(limit),
  });
  if (fromTimestamp) params.set("from", String(fromTimestamp));

  const res = await fetch(`${BASE}?${params}`, { cache: "no-store" });
  const data = (await safeJson(res)) as LastFmResponse | null;
  if (!data || data.error) {
    throw new Error(data?.message ?? `Last.fm API error ${data?.error ?? res.status}`);
  }

  const raw = data.recenttracks?.track;
  if (!raw) return [];
  const tracks = Array.isArray(raw) ? raw : [raw];

  return tracks
    .filter((t) => t.date?.uts)
    .map((t) => mapTrack(t, new Date(parseInt(t.date!.uts, 10) * 1000)));
}

function mapTrack(t: LastFmTrack, playedAt: Date) {
  const imgs = Array.isArray(t.image) ? t.image : [];
  const img = imgs.find((i: { size?: string }) => i?.size === "extralarge" || i?.size === "large") ?? imgs[imgs.length - 1];
  const imgUrl = img && typeof img === "object" && "#text" in img ? (img as { "#text": string })["#text"] : null;
  return {
    artist: (t.artist as { "#text"?: string })?.["#text"] ?? "Unknown",
    name: t.name ?? "Unknown",
    album: (t.album as { "#text"?: string })?.["#text"] ?? "",
    playedAt,
    image: imgUrl && imgUrl.length > 0 ? imgUrl : null,
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
    album?: { image?: { size?: string; "#text"?: string }[] };
  };
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

const MAX_SCROBBLE_MS = 15 * 60 * 1000;

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
  let ms = n > 7200 ? n : n * 1000;
  if (ms > MAX_SCROBBLE_MS) ms = MAX_SCROBBLE_MS;
  return ms;
}

/** Minutes credited per Last.fm scrobble (we don't get real listen time). */
export function lastFmScrobbleDurationMs(): number {
  return lastFmDefaultDurationMs();
}

export async function getTrackArt(artist: string, track: string): Promise<string | null> {
  const data = await fetchTrackInfo(artist, track);
  if (!data) return null;
  const album = data.track?.album;
  const imgs = Array.isArray(album?.image) ? album.image : [];
  const img =
    imgs.find((i) => i?.size === "extralarge" || i?.size === "large") ?? imgs[imgs.length - 1];
  const url = img?.["#text"];
  if (!url || url.length === 0 || isPlaceholderUrl(url)) return null;
  return url;
}

export function lastFmDefaultDurationMs(): number {
  const raw = process.env.LASTFM_DEFAULT_DURATION_MS?.trim();
  if (raw) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 180_000;
}

const PLACEHOLDER_HASH = "2a96cbd8b46e442fc41c2b86b821562f";

function isPlaceholderUrl(url: string): boolean {
  return url.includes(PLACEHOLDER_HASH);
}

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
    artist?: { image?: { size?: string; "#text"?: string }[] };
  } | null;
  if (!data || data.error) return null;
  const imgs = Array.isArray(data.artist?.image) ? data.artist.image : [];
  const img =
    imgs.find((i) => i?.size === "extralarge" || i?.size === "large") ?? imgs[imgs.length - 1];
  const url = img?.["#text"];
  if (!url || url.length === 0 || isPlaceholderUrl(url)) return null;
  return url;
}
