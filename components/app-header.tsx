"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DisplayPreferences } from "@/components/display-preferences";
import { LiveSyncStatus } from "@/components/live-sync-status";
import { AccountMenu } from "@/components/account-menu";
import { createNavLinks, type NavAppKind } from "@/lib/nav-links";
import {
  defaultStatsNavQuery,
  getStoredTimeFilter,
  statsQueryFromStoredFilter,
} from "@/lib/stats-session-preferences";
import { pathMatchesNav } from "@/lib/nav-match";

const navLinkClass = (active: boolean) =>
  cn(
    "box-border inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-2 text-xs font-medium leading-none transition-colors sm:px-3 sm:text-[13px]",
    active
      ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/30"
      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
  );

export function AppHeader({
  mobileOpen,
  onMobileOpenChange,
}: {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const [statsNavQuery, setStatsNavQuery] = useState(() => defaultStatsNavQuery());

  const navApp: NavAppKind = pathname.startsWith("/demo") ? "demo" : "main";

  useEffect(() => {
    setStatsNavQuery(statsQueryFromStoredFilter(getStoredTimeFilter()));
  }, [pathname]);

  const { all: NAV_LINKS } = createNavLinks(navApp, statsNavQuery);

  const homeHref =
    navApp === "demo" ? `/demo?${statsNavQuery}` : `/me?${statsNavQuery}`;

  return (
    <>
      <header className="sticky top-0 z-50 overflow-visible border-b border-border/60 bg-background/88 backdrop-blur-xl pt-[env(safe-area-inset-top,0px)]">
        <div className="app-container grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 overflow-visible py-3 md:grid-cols-[auto_minmax(0,1fr)_auto]">
          <Link
            href={homeHref}
            className="min-w-0 shrink-0 font-display text-lg font-semibold tracking-tight"
            onClick={() => onMobileOpenChange(false)}
          >
            <span className="text-primary">Sound</span>
            <span className="text-foreground">folio</span>
          </Link>

          <nav
            className="hidden min-w-0 w-full max-w-full justify-self-center overflow-visible md:col-span-1 md:col-start-2 md:row-start-1 md:flex md:justify-center"
            aria-label="Main"
          >
            <div className="flex min-w-0 max-w-full justify-center overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden touch-pan-x py-2">
              <div className="flex w-max flex-nowrap items-center gap-0.5 sm:gap-1">
                {NAV_LINKS.map((link) => {
                  const { href, label, shortLabel, icon: Icon } = link;
                  const active = pathMatchesNav(pathname, href);
                  return (
                    <Link key={href} href={href} className={navLinkClass(active)}>
                      <Icon className="h-3.5 w-3.5 opacity-80" aria-hidden />
                      <span className="hidden lg:inline">{label}</span>
                      <span className="lg:hidden">{shortLabel}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>

          <div className="flex items-center justify-self-end gap-1">
            <LiveSyncStatus />
            <DisplayPreferences />
            <AccountMenu />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 md:hidden"
              aria-expanded={mobileOpen}
              aria-controls="mobile-drawer-nav"
              onClick={() => onMobileOpenChange(!mobileOpen)}
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
              <span className="sr-only">{mobileOpen ? "Close menu" : "Open menu"}</span>
            </Button>
          </div>
        </div>
      </header>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/70 md:hidden"
          aria-label="Close menu"
          onClick={() => onMobileOpenChange(false)}
        />
      ) : null}

      <aside
        id="mobile-drawer-nav"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[min(18rem,92vw)] flex-col border-l border-border/60 bg-card pb-[env(safe-area-inset-bottom,0px)] pl-3 pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[calc(1.5rem+env(safe-area-inset-top,0px))] shadow-2xl transition-transform duration-200 ease-out md:hidden",
          mobileOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
        )}
        aria-hidden={!mobileOpen}
      >
        <div className="mb-4 flex items-center justify-between pl-1">
          <span className="font-display text-lg font-semibold">
            <span className="text-primary">Sound</span>
            <span className="text-foreground">folio</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            onClick={() => onMobileOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        {navApp === "main" ? (
          <div className="mb-3 pl-1">
            <LiveSyncStatus fullWidth />
          </div>
        ) : null}
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto pl-1" aria-label="Mobile">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathMatchesNav(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => onMobileOpenChange(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
