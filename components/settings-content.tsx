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

export function SettingsContent() {
  const { user, signOutUser } = useAuth();
  const { loading: syncing, label, outcome, runningMessage, sync, canSync } = useLastFmSync();
  const { streams, cacheMeta, refreshing, clearCache, reload } = useStreams();
  const router = useRouter();
  const [lastfmUsername, setLastfmUsernameInput] = useState("");
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  const syncMessage = syncing ? runningMessage : outcome?.message ?? null;
  const syncKind = outcome?.kind ?? null;

  return (
    <PageShell width="default">
      <PageHeader
        title="Settings"
        description="Account, sync, and appearance."
      />

      <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
        <SettingsSection title="Account" description={user?.email ?? undefined}>
        {user?.email ? (
          <p className="sr-only">{user.email}</p>
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
      </SettingsSection>

      <SettingsSection title="Data" description="Sync, import, and local cache.">
        <Button type="button" onClick={() => void sync()} disabled={!canSync}>
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
        <div className="rounded-lg border border-border/40 bg-secondary/20 p-3 text-xs text-muted-foreground">
          <div className="grid gap-1 sm:grid-cols-2">
            <p><span className="text-foreground">{streams.length.toLocaleString()}</span> streams loaded</p>
            <p><span className="text-foreground">{cacheMeta?.streamCount?.toLocaleString() ?? "0"}</span> cached locally</p>
            <p>Cache: <span className="text-foreground">{cacheMeta?.fullyLoaded ? "full history" : "still filling"}</span></p>
            <p>{refreshing ? "Refreshing in background" : cacheMeta?.savedAt ? `Updated ${new Date(cacheMeta.savedAt).toLocaleString()}` : "No cache yet"}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
              Refresh cache
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void clearCache()}>
              Clear local cache
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
