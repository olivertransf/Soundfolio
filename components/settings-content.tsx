"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { DisplayPreferencesPanel } from "@/components/display-preferences-panel";
import { PageHeader, PageShell } from "@/components/page-shell";
import { SettingsSection } from "@/components/settings-section";
import { useStreams } from "@/components/streams-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getUserProfile, setLastfmUsername } from "@/lib/firestore/user-profile";
import { useLastFmSync } from "@/hooks/use-lastfm-sync";
import { backfillAlbumArtwork } from "@/lib/sync/backfill-album-artwork";
import { backfillArtistArtwork } from "@/lib/sync/backfill-artist-artwork";
import { backfillLastFmCatalogDurations } from "@/lib/sync/backfill-lastfm-durations";
import { albumGroupKey, normalizeEntityKey } from "@/lib/entity-normalize";
import { isUsableArtUrl } from "@/lib/stats-compute";

export function SettingsContent() {
  const { user, signOutUser } = useAuth();
  const { loading: syncing, label, outcome, runningMessage, sync, canSync } = useLastFmSync();
  const { streams, cacheMeta, refreshing, clearCache, reload, setStreams, fullyLoaded } = useStreams();
  const router = useRouter();
  const [lastfmUsername, setLastfmUsernameInput] = useState("");
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fixingDurations, setFixingDurations] = useState(false);
  const [durationMessage, setDurationMessage] = useState<string | null>(null);
  const [durationError, setDurationError] = useState(false);
  const [fixingArtistArt, setFixingArtistArt] = useState(false);
  const [artistArtMessage, setArtistArtMessage] = useState<string | null>(null);
  const [artistArtError, setArtistArtError] = useState(false);
  const [fixingAlbumArt, setFixingAlbumArt] = useState(false);
  const [albumArtMessage, setAlbumArtMessage] = useState<string | null>(null);
  const [albumArtError, setAlbumArtError] = useState(false);

  useEffect(() => {
    if (!user) return;
    void getUserProfile(user.uid).then((profile) => {
      setLastfmUsernameInput(profile?.lastfmUsername ?? "");
    });
  }, [user]);

  async function saveUsername() {
    if (!user) return;
    setSaving(true);
    setUsernameMessage(null);
    try {
      await setLastfmUsername(user.uid, lastfmUsername);
      setUsernameMessage("Saved");
    } catch (error) {
      setUsernameMessage(error instanceof Error ? error.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function fixSongLengths() {
    if (!user) return;
    setFixingDurations(true);
    setDurationError(false);
    setDurationMessage("Starting…");
    try {
      const { result, streams: next } = await backfillLastFmCatalogDurations(
        user.uid,
        streams,
        (progress) => setDurationMessage(progress.message)
      );
      setStreams(next);
      setDurationMessage(result.message);
    } catch (error) {
      setDurationError(true);
      setDurationMessage(error instanceof Error ? error.message : "Could not fix song lengths");
    } finally {
      setFixingDurations(false);
    }
  }

  async function fixArtistArtwork() {
    if (!user) return;
    setFixingArtistArt(true);
    setArtistArtError(false);
    setArtistArtMessage("Starting…");
    try {
      const { result, streams: next } = await backfillArtistArtwork(
        user.uid,
        streams,
        (progress) => setArtistArtMessage(progress.message)
      );
      setStreams(next);
      setArtistArtMessage(result.message);
    } catch (error) {
      setArtistArtError(true);
      setArtistArtMessage(error instanceof Error ? error.message : "Could not fix artist artwork");
    } finally {
      setFixingArtistArt(false);
    }
  }

  async function fixAlbumArtwork() {
    if (!user) return;
    setFixingAlbumArt(true);
    setAlbumArtError(false);
    setAlbumArtMessage("Starting…");
    try {
      const { result, streams: next } = await backfillAlbumArtwork(
        user.uid,
        streams,
        (progress) => setAlbumArtMessage(progress.message)
      );
      setStreams(next);
      setAlbumArtMessage(result.message);
    } catch (error) {
      setAlbumArtError(true);
      setAlbumArtMessage(error instanceof Error ? error.message : "Could not fix album artwork");
    } finally {
      setFixingAlbumArt(false);
    }
  }

  const syncMessage = syncing ? runningMessage : outcome?.message ?? null;
  const syncKind = outcome?.kind ?? null;
  const lastFmCount = streams.filter((stream) => stream.trackId.startsWith("lfm-")).length;
  const missingArtistArtCount = new Set(
    streams
      .filter((stream) => !isUsableArtUrl(stream.artistArt))
      .map((stream) => stream.artistName)
  ).size;
  const missingAlbumArtCount = new Set(
    streams
      .filter((stream) => !isUsableArtUrl(stream.albumArt))
      .map((stream) =>
        stream.albumName.trim()
          ? albumGroupKey(stream.albumName, stream.artistName)
          : `track:${normalizeEntityKey(stream.trackName)}\0${normalizeEntityKey(stream.artistName)}`
      )
  ).size;
  const backfillBusy = fixingDurations || fixingArtistArt || fixingAlbumArt;

  return (
    <PageShell>
      <PageHeader title="Settings" />

      <div className="grid gap-3 lg:grid-cols-2 lg:items-stretch">
        <SettingsSection title="Account" className="flex h-full flex-col gap-3">
          {user?.email ? (
            <p className="text-xs text-muted-foreground">{user.email}</p>
          ) : null}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Last.fm username
            </label>
            <Input
              value={lastfmUsername}
              onChange={(e) => setLastfmUsernameInput(e.target.value)}
              placeholder="yourname"
              autoCapitalize="none"
              autoCorrect="off"
              className="h-11"
            />
            {usernameMessage ? (
              <p className="text-xs text-muted-foreground">{usernameMessage}</p>
            ) : null}
            <Button
              type="button"
              className="h-11 w-full sm:w-auto"
              onClick={() => void saveUsername()}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save username"}
            </Button>
          </div>
          <div className="mt-auto pt-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full sm:w-auto"
              onClick={() => {
                void (async () => {
                  await signOutUser();
                  router.push("/auth");
                  router.refresh();
                })();
              }}
            >
              Sign out
            </Button>
          </div>
        </SettingsSection>

        <SettingsSection title="Data" className="flex h-full flex-col gap-3">
          <Button
            type="button"
            className="h-11 w-full sm:w-auto"
            onClick={() => void sync()}
            disabled={!canSync}
          >
            {syncing ? "Syncing…" : "Sync Last.fm"}
          </Button>
          {syncing && syncMessage ? (
            <p className="text-sm text-muted-foreground">{label}</p>
          ) : null}
          {syncMessage && !syncing ? (
            <p
              className={
                syncKind === "failed"
                  ? "text-sm text-destructive"
                  : syncKind === "added"
                    ? "text-sm text-emerald-600 dark:text-emerald-400"
                    : "text-sm text-muted-foreground"
              }
            >
              {syncMessage}
            </p>
          ) : null}
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full sm:w-auto"
              onClick={() => void fixSongLengths()}
              disabled={backfillBusy || !user || lastFmCount === 0}
            >
              {fixingDurations ? "Fixing lengths…" : "Fix song lengths"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Replace flat 3-minute Last.fm defaults with real catalog lengths from Last.fm.
              {!fullyLoaded
                ? " Load full history first so every play is included."
                : ` ${lastFmCount.toLocaleString()} Last.fm plays loaded.`}
            </p>
            {durationMessage ? (
              <p
                className={
                  durationError ? "text-sm text-destructive" : "text-sm text-muted-foreground"
                }
              >
                {durationMessage}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full sm:w-auto"
              onClick={() => void fixArtistArtwork()}
              disabled={backfillBusy || !user || missingArtistArtCount === 0}
            >
              {fixingArtistArt ? "Fixing artwork…" : "Fix artist artwork"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Fill missing artist images via Last.fm, Discogs, and Deezer.
              {!fullyLoaded
                ? " Load full history first so every artist is included."
                : ` ${missingArtistArtCount.toLocaleString()} artists still missing art.`}
            </p>
            {artistArtMessage ? (
              <p
                className={
                  artistArtError ? "text-sm text-destructive" : "text-sm text-muted-foreground"
                }
              >
                {artistArtMessage}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full sm:w-auto"
              onClick={() => void fixAlbumArtwork()}
              disabled={backfillBusy || !user || missingAlbumArtCount === 0}
            >
              {fixingAlbumArt ? "Fixing artwork…" : "Fix album artwork"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Fill missing covers via Last.fm, iTunes, and Cover Art Archive.
              {!fullyLoaded
                ? " Load full history first so every album is included."
                : ` ${missingAlbumArtCount.toLocaleString()} albums still missing art.`}
            </p>
            {albumArtMessage ? (
              <p
                className={
                  albumArtError ? "text-sm text-destructive" : "text-sm text-muted-foreground"
                }
              >
                {albumArtMessage}
              </p>
            ) : null}
          </div>
          <Link
            href="/history/import"
            className="inline-flex h-11 items-center text-sm font-medium text-primary hover:underline"
          >
            Import Spotify history
          </Link>
          <div className="mt-auto space-y-3 border border-border bg-secondary/20 p-3 text-xs text-muted-foreground">
            <div className="grid gap-1 sm:grid-cols-2">
              <p>
                <span className="text-foreground">{streams.length.toLocaleString()}</span> loaded
              </p>
              <p>
                <span className="text-foreground">
                  {cacheMeta?.streamCount?.toLocaleString() ?? "0"}
                </span>{" "}
                cached
              </p>
              <p>
                Cache:{" "}
                <span className="text-foreground">
                  {cacheMeta?.fullyLoaded ? "full" : "filling"}
                </span>
              </p>
              <p>
                {refreshing
                  ? "Refreshing…"
                  : cacheMeta?.savedAt
                    ? `Updated ${new Date(cacheMeta.savedAt).toLocaleString()}`
                    : "No cache"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => void reload()}
              >
                Refresh cache
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => void clearCache()}
              >
                Clear cache
              </Button>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Appearance" className="lg:col-span-2">
          <DisplayPreferencesPanel />
        </SettingsSection>
      </div>
    </PageShell>
  );
}
