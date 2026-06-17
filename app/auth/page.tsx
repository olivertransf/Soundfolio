"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

function AuthForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/onboarding";
  const { configured, signInWithGoogle } = useAuth();

  async function handleGoogle() {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  if (!configured) {
    return (
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-border/60 bg-card/70 p-6 text-center">
        <h1 className="text-xl font-semibold">Firebase not configured</h1>
        <p className="text-sm text-muted-foreground">
          Add your Firebase web config to environment variables before using public sign-in.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-border/60 bg-card/70 p-6 shadow-2xl">
      <div className="space-y-2 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Soundfolio</p>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Sign in with Google to track your listening stats.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <button
        type="button"
        disabled={loading}
        onClick={() => void handleGoogle()}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary/70 disabled:opacity-50"
      >
        {loading ? "Signing in..." : "Continue with Google"}
      </button>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center">Loading...</div>}>
      <div className="flex min-h-dvh items-center justify-center p-4">
        <AuthForm />
      </div>
    </Suspense>
  );
}
