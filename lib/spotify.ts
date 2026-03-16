const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
const REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN!;

const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    throw new Error("Missing SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, or SPOTIFY_REFRESH_TOKEN in environment");
  }

  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: REFRESH_TOKEN,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    cachedToken = null;
    const msg = data?.error_description ?? data?.error ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return cachedToken.token;
}

export interface RecentlyPlayedItem {
  track: {
    id: string;
    name: string;
    duration_ms: number;
    album: {
      name: string;
      images: { url: string; width: number; height: number }[];
    };
    artists: { name: string }[];
  };
  played_at: string;
}

export async function getRecentlyPlayed(after?: string): Promise<{
  items: RecentlyPlayedItem[];
  cursors?: { after: string; before: string };
}> {
  const token = await getAccessToken();
  const params = new URLSearchParams({ limit: "50" });
  if (after) params.set("after", after);

  const res = await fetch(
    `https://api.spotify.com/v1/me/player/recently-played?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data?.error?.message ?? data?.error ?? `HTTP ${res.status}`;
    throw new Error(`Spotify recently-played: ${msg}`);
  }

  return res.json();
}

export interface TopItem {
  id: string;
  name: string;
  images?: { url: string }[];
  album?: { images: { url: string }[] };
  artists?: { name: string }[];
  duration_ms?: number;
}

export async function getTopItems(
  type: "artists" | "tracks",
  timeRange: "short_term" | "medium_term" | "long_term" = "medium_term",
  limit = 50
): Promise<TopItem[]> {
  const token = await getAccessToken();
  const params = new URLSearchParams({
    time_range: timeRange,
    limit: String(limit),
  });

  const res = await fetch(
    `https://api.spotify.com/v1/me/top/${type}?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    throw new Error(`Spotify API error: ${res.status}`);
  }

  const data = await res.json();
  return data.items;
}

export async function getTracks(trackIds: string[]) {
  if (trackIds.length === 0) return [];
  const token = await getAccessToken();
  const ids = trackIds.slice(0, 50).join(",");
  const res = await fetch(
    `https://api.spotify.com/v1/tracks?ids=${ids}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Spotify API error: ${res.status}`);
  const data = await res.json();
  return (data.tracks ?? []).filter(Boolean).map((t: { id: string; album?: { images: { url: string }[] } }) => ({
    id: t.id,
    albumArt: t.album?.images?.[0]?.url ?? null,
  }));
}

export async function getCurrentlyPlaying(): Promise<{
  is_playing: boolean;
  item?: {
    id: string;
    name: string;
    duration_ms: number;
    progress_ms: number;
    album: { name: string; images: { url: string }[] };
    artists: { name: string }[];
  };
  progress_ms?: number;
} | null> {
  const token = await getAccessToken();

  const res = await fetch(
    "https://api.spotify.com/v1/me/player/currently-playing",
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (res.status === 204 || !res.ok) return null;
  return res.json();
}
