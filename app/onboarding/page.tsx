"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function OnboardingForm() {
  const [lastfmUsername, setLastfmUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/me";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastfmUsername }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save profile");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-border/60 bg-card/70 p-6 shadow-2xl">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Setup</p>
        <h1 className="text-2xl font-semibold tracking-tight">Connect Last.fm</h1>
        <p className="text-sm text-muted-foreground">
          Enter the username from your Last.fm profile URL, for example{" "}
          <span className="font-mono text-foreground">last.fm/user/yourname</span>.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={lastfmUsername}
          onChange={(e) => setLastfmUsername(e.target.value)}
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
