"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { StreamsProvider } from "@/components/streams-provider";
import { StreamsLoadBanner } from "@/components/streams-load-banner";
import { getUserProfile, userNeedsOnboarding } from "@/lib/firestore/user-profile";
import { firestoreErrorMessage } from "@/lib/firestore/errors";

export function DashboardShell({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [profileLoading, setProfileLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      const next = encodeURIComponent(pathname || "/me");
      router.replace(`/auth?next=${next}`);
      return;
    }

    let cancelled = false;
    void (async () => {
      setProfileLoading(true);
      setError(null);
      try {
        const profile = await getUserProfile(user.uid);
        if (cancelled) return;
        if (userNeedsOnboarding(profile)) {
          router.replace(`/onboarding?next=${encodeURIComponent(pathname || "/me")}`);
          return;
        }
        setAllowed(true);
      } catch (err) {
        if (cancelled) return;
        setError(firestoreErrorMessage(err, "Could not load your profile."));
        setAllowed(false);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, router, pathname]);

  if (authLoading || profileLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <button
          type="button"
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary/60"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <StreamsProvider>
      <StreamsLoadBanner />
      {children}
    </StreamsProvider>
  );
}
