"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { StreamsProvider } from "@/components/streams-provider";
import { LastFmSyncProvider } from "@/components/lastfm-sync-provider";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = pathname === "/auth" || pathname === "/onboarding";
  const isDemo = pathname.startsWith("/demo");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  if (isAuth) {
    return <>{children}</>;
  }

  const shell = (
    <div className="flex min-h-dvh min-h-screen min-w-0 flex-col bg-background">
      <AppHeader mobileOpen={mobileNavOpen} onMobileOpenChange={setMobileNavOpen} />
      <main className="app-container flex-1 py-4 sm:py-5 lg:py-6">{children}</main>
    </div>
  );

  if (isDemo) {
    return shell;
  }

  return (
    <StreamsProvider>
      <LastFmSyncProvider>{shell}</LastFmSyncProvider>
    </StreamsProvider>
  );
}
