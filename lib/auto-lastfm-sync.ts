export const AUTO_SYNC_KEY = "soundfolio:auto-lastfm-sync";
export const LAST_SYNC_AT_KEY = "soundfolio:last-lastfm-sync-at";
export const AUTO_SYNC_STALE_MS = 15 * 60 * 1000;
export const AUTO_SYNC_EVENT = "soundfolio:auto-sync";

export function loadAutoSyncEnabled(): boolean {
  try {
    return window.localStorage.getItem(AUTO_SYNC_KEY) !== "0";
  } catch {
    return true;
  }
}

export function saveAutoSyncEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(AUTO_SYNC_KEY, enabled ? "1" : "0");
    window.dispatchEvent(new Event(AUTO_SYNC_EVENT));
  } catch {
    // no-op
  }
}

export function readLastSyncAt(): number {
  try {
    const raw = Number(window.localStorage.getItem(LAST_SYNC_AT_KEY) ?? "0");
    return Number.isFinite(raw) ? raw : 0;
  } catch {
    return 0;
  }
}

export function writeLastSyncAt(at = Date.now()) {
  try {
    window.localStorage.setItem(LAST_SYNC_AT_KEY, String(at));
  } catch {
    // no-op
  }
}
