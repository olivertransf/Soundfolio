import { createHash } from "crypto";

export function lastFmTrackId(artistName: string, trackName: string, albumName = "") {
  const key = [artistName, trackName, albumName]
    .map((part) => part.trim().toLocaleLowerCase())
    .join("|");
  return `lfm-track-${createHash("sha1").update(key).digest("hex").slice(0, 16)}`;
}
