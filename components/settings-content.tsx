"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { DisplayPreferencesPanel } from "@/components/display-preferences-panel";
import { PageHeader, PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getUserProfile, setLastfmUsername } from "@/lib/firestore/user-profile";
import { useLastFmSync } from "@/hooks/use-lastfm-sync";

export function SettingsContent() {
  const { user, signOutUser } = useAuth();
  const { loading: syncing, label, outcome, runningMessage, sync, canSync } = useLastFmSync();
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
    <PageShell className="max-w-5xl">
      <PageHeader
        title="Settings"
        description="Account, sync, and appearance."
      />

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
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
      </section>

      <section className="space-y-4 rounded-2xl border border-border/40 bg-card/40 p-5 lg:col-span-2">
        <h2 className="text-sm font-semibold">Appearance</h2>
        <DisplayPreferencesPanel />
        </section>
      </div>
    </PageShell>
  );
}
