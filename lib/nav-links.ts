import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Library, Settings } from "lucide-react";
import { defaultStatsNavQuery } from "@/lib/stats-session-preferences";

export interface NavLinkItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}

export type NavAppKind = "main" | "demo";

function statsSuffix(statsQuery: string): string {
  const q = statsQuery.trim() || defaultStatsNavQuery();
  const clean = q.replace(/^\?/, "");
  return clean ? `?${clean}` : "";
}

export type NavLinksBundle = {
  main: NavLinkItem[];
  library: NavLinkItem[];
  more: NavLinkItem[];
  all: NavLinkItem[];
};

export function createNavLinks(
  app: NavAppKind,
  statsQuery: string = defaultStatsNavQuery()
): NavLinksBundle {
  const s = statsSuffix(statsQuery);

  if (app === "demo") {
    const main: NavLinkItem[] = [
      { href: `/demo${s}`, label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard },
      { href: `/demo/library${s}`, label: "Library", shortLabel: "Library", icon: Library },
    ];
    const library: NavLinkItem[] = [];
    const more: NavLinkItem[] = [];
    const all = [...main];
    return { main, library, more, all };
  }

  const main: NavLinkItem[] = [
    { href: `/me${s}`, label: "Dashboard", shortLabel: "Dashboard", icon: LayoutDashboard },
    { href: `/library${s}`, label: "Library", shortLabel: "Library", icon: Library },
    { href: "/settings", label: "Settings", shortLabel: "Settings", icon: Settings },
  ];
  const library: NavLinkItem[] = [];
  const more: NavLinkItem[] = [];
  const all = [...main];
  return { main, library, more, all };
}

const staticQuery = defaultStatsNavQuery();
const staticBundle = createNavLinks("main", staticQuery);

export const NAV_LINKS_MAIN: NavLinkItem[] = staticBundle.main;
export const NAV_LINKS_LIBRARY: NavLinkItem[] = staticBundle.library;
export const NAV_LINKS_MORE: NavLinkItem[] = staticBundle.more;
export const NAV_LINKS: NavLinkItem[] = staticBundle.all;
