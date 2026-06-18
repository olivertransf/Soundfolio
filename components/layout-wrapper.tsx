"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/app-header";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = pathname === "/auth" || pathname === "/onboarding";
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

  return (
    <div className="flex min-h-dvh min-h-screen min-w-0 flex-col bg-background">
      <AppHeader mobileOpen={mobileNavOpen} onMobileOpenChange={setMobileNavOpen} />
      <main className="app-container flex-1 py-5 sm:py-7 lg:py-8">{children}</main>
    </div>
  );
}
