import { createHash } from "crypto";

function hashKey(parts: string[]) {
  return createHash("sha1")
    .update(parts.map((p) => p.trim().toLocaleLowerCase()).join("|"))
    .digest("hex");
}

/** Stable id for grouping the same song (tops, diversity). */
export function lastFmTrackId(artistName: string, trackName: string, albumName = "") {
  return `lfm-track-${hashKey([artistName, trackName, albumName]).slice(0, 16)}`;
}

/** One row per scrobble — must not collide when trackId format changes. */
export function lastFmScrobbleStreamId(
  artistName: string,
  trackName: string,
  playedAt: Date
) {
  return `lfm-${hashKey([artistName, trackName, playedAt.toISOString()]).slice(0, 24)}`;
}

export function scrobbleIdentityKey(
  artistName: string,
  trackName: string,
  playedAt: Date
) {
  return `${artistName.trim().toLocaleLowerCase()}\0${trackName.trim().toLocaleLowerCase()}\0${playedAt.getTime()}`;
}
