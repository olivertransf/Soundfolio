"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { StreamsProvider } from "@/components/streams-provider";
import { getUserProfile, userNeedsOnboarding } from "@/lib/firestore/user-profile";

export function DashboardShell({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [profileLoading, setProfileLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

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
      try {
        const profile = await getUserProfile(user.uid);
        if (cancelled) return;
        if (userNeedsOnboarding(profile)) {
          router.replace(`/onboarding?next=${encodeURIComponent(pathname || "/me")}`);
          return;
        }
        setAllowed(true);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, router, pathname]);

  if (authLoading || profileLoading || !allowed) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return <StreamsProvider>{children}</StreamsProvider>;
}
