"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useOptionalStreams } from "@/components/streams-provider";
import { DisplayPreferencesPanel } from "@/components/display-preferences-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getUserProfile, setLastfmUsername } from "@/lib/firestore/user-profile";
import { runLastFmSync } from "@/lib/sync/run-lastfm-sync";

export function SettingsContent() {
  const { user, signOutUser } = useAuth();
  const streamsCtx = useOptionalStreams();
  const router = useRouter();
  const [lastfmUsername, setLastfmUsernameInput] = useState("");
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [syncSaved, setSyncSaved] = useState(0);
  const [syncPending, setSyncPending] = useState(0);
  const [syncKind, setSyncKind] = useState<"added" | "upToDate" | "skipped" | "failed" | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

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
      setUsernameMessage("Username saved");
    } catch (error) {
      setUsernameMessage(error instanceof Error ? error.message : "Could not save username");
    } finally {
      setSaving(false);
    }
  }

  async function syncNow() {
    if (!user || !streamsCtx) return;
    setSyncing(true);
    setSyncMessage(null);
    setSyncProgress("Connecting to Last.fm…");
    setSyncSaved(0);
    setSyncPending(0);
    setSyncKind(null);
    try {
      const working = [...streamsCtx.streams];
      const result = await runLastFmSync(user.uid, working, (progress) => {
        setSyncProgress(progress.message);
        setSyncSaved(progress.importedCount);
        setSyncPending(progress.pendingCount ?? 0);
      });
      await streamsCtx.reload();
      setSyncMessage(result.message);
      setSyncKind(result.kind);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      setSyncMessage(message);
      setSyncKind("failed");
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="text-sm text-muted-foreground">Account, sync, and appearance.</p>
      </div>

      <section className="space-y-4 rounded-2xl border border-border/40 bg-card/40 p-5">
        <h2 className="text-sm font-semibold">Account</h2>
        {user?.email ? (
          <p className="text-sm text-muted-foreground">{user.email}</p>
        ) : null}
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Last.fm username
          </label>
          <Input
            value={lastfmUsername}
            onChange={(e) => setLastfmUsernameInput(e.target.value)}
            placeholder="yourname"
            autoCapitalize="none"
            autoCorrect="off"
          />
          {usernameMessage ? (
            <p className="text-xs text-muted-foreground">{usernameMessage}</p>
          ) : null}
          <Button type="button" onClick={() => void saveUsername()} disabled={saving}>
            {saving ? "Saving…" : "Save username"}
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
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
      </section>

      <section className="space-y-4 rounded-2xl border border-border/40 bg-card/40 p-5">
        <h2 className="text-sm font-semibold">Data</h2>
        <Button type="button" onClick={() => void syncNow()} disabled={syncing || !streamsCtx}>
          {syncing ? "Syncing…" : "Sync Last.fm"}
        </Button>
        {syncing && (syncSaved > 0 || syncProgress) ? (
          <div className="space-y-1">
            {syncSaved > 0 ? (
              <p className="text-sm font-medium">
                {syncPending > 0
                  ? `Saved ${syncSaved} · ${syncPending} remaining`
                  : `Saved ${syncSaved} scrobbles`}
              </p>
            ) : null}
            {syncProgress ? (
              <p className="text-sm text-muted-foreground">{syncProgress}</p>
            ) : null}
          </div>
        ) : null}
        {syncMessage ? (
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
        ) : (
          <p className="text-sm text-muted-foreground">
            Pulls new scrobbles from Last.fm into your library.
          </p>
        )}
        <p className="text-sm">
          <Link href="/history/import" className="font-medium text-primary hover:underline">
            Import Spotify history on web
          </Link>
        </p>
      </section>

      <section className="space-y-4 rounded-2xl border border-border/40 bg-card/40 p-5">
        <h2 className="text-sm font-semibold">Appearance</h2>
        <DisplayPreferencesPanel />
      </section>
    </div>
  );
}
