import { getAlbumArtFromCoverArtArchive } from "@/lib/coverartarchive";
import { getArtistArtFromDeezer } from "@/lib/deezer";
import { getArtistArtFromDiscogs } from "@/lib/discogs";
import { getAlbumArtFromItunes, getSongArtFromItunes } from "@/lib/itunes";
import {
  getAlbumArt,
  getArtistArt,
  getTrackArt,
  isLastFmConfigured,
  isLastFmPlaceholderUrl,
} from "@/lib/lastfm";

export async function resolveAlbumArt(m: {
  trackName: string;
  artistName: string;
  albumName: string;
  scrobbleImage?: string | null;
}): Promise<string | null> {
  if (m.scrobbleImage && !isLastFmPlaceholderUrl(m.scrobbleImage)) {
    return m.scrobbleImage;
  }

  if (isLastFmConfigured()) {
    try {
      const fromTrack = await getTrackArt(m.artistName, m.trackName);
      if (fromTrack) return fromTrack;
    } catch {
      // fall through
    }
    if (m.albumName.trim()) {
      try {
        const fromAlbum = await getAlbumArt(m.artistName, m.albumName);
        if (fromAlbum) return fromAlbum;
      } catch {
        // fall through
      }
    }
  }

  try {
    const fromSong = await getSongArtFromItunes(m.artistName, m.trackName);
    if (fromSong) return fromSong;
  } catch {
    // fall through
  }

  try {
    const fromItunes = await getAlbumArtFromItunes(m.artistName, m.albumName);
    if (fromItunes) return fromItunes;
  } catch {
    // fall through
  }

  try {
    return await getAlbumArtFromCoverArtArchive(m.artistName, m.albumName);
  } catch {
    return null;
  }
}

/** Last.fm artist image when available; otherwise Discogs → Deezer. */
export async function resolveArtistArt(artistName: string): Promise<string | null> {
  if (isLastFmConfigured()) {
    try {
      const fromLastFm = await getArtistArt(artistName);
      if (fromLastFm) return fromLastFm;
    } catch {
      // fall through
    }
  }

  try {
    const fromDiscogs = await getArtistArtFromDiscogs(artistName);
    if (fromDiscogs) return fromDiscogs;
  } catch {
    // fall through
  }

  try {
    return await getArtistArtFromDeezer(artistName);
  } catch {
    return null;
  }
}
