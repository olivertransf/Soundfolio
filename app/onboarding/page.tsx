"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { firestoreErrorMessage } from "@/lib/firestore/errors";
import { setLastfmUsername } from "@/lib/firestore/user-profile";

function OnboardingForm() {
  const [lastfmUsername, setLastfmUsernameInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/me";
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/auth?next=${encodeURIComponent("/onboarding")}`);
    }
  }, [authLoading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    setLoading(true);
    try {
      await setLastfmUsername(user.uid, lastfmUsername);
      router.push(next);
    } catch (err) {
      setError(firestoreErrorMessage(err, "Could not save profile"));
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-border/60 bg-card/70 p-6 shadow-2xl">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Setup</p>
        <h1 className="text-2xl font-semibold tracking-tight">Connect Last.fm</h1>
        <p className="text-sm text-muted-foreground">
          Enter the username from your Last.fm profile URL, for example{" "}
          <span className="font-mono text-foreground">last.fm/user/yourname</span>.
          Your Dashboard is home after setup. Import Spotify history from Settings if needed.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={lastfmUsername}
          onChange={(e) => setLastfmUsernameInput(e.target.value)}
          placeholder="Last.fm username"
          autoComplete="username"
          required
          className="w-full rounded-lg border border-border bg-secondary px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Continue to dashboard"}
        </button>
      </form>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center">Loading...</div>}>
      <div className="flex min-h-dvh items-center justify-center p-4">
        <OnboardingForm />
      </div>
    </Suspense>
  );
}
