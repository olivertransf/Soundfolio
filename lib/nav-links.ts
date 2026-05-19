import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Music,
  Mic2,
  Disc,
  Clock3,
  Upload,
} from "lucide-react";
import { defaultStatsNavQuery } from "@/lib/stats-session-preferences";

export interface NavLinkItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}

/** Logged-in app uses `/me` for overview and root paths for the rest. */
export type NavAppKind = "main" | "demo";

function statsSuffix(statsQuery: string): string {
  const q = statsQuery.trim() || defaultStatsNavQuery();
  const clean = q.replace(/^\?/, "");
  return clean ? `?${clean}` : "";
}

export type NavLinksBundle = {
  /** Primary destinations. */
  main: NavLinkItem[];
  topRanked: NavLinkItem[];
  more: NavLinkItem[];
  /** Flat order for desktop and mobile navigation. */
  all: NavLinkItem[];
};

export function createNavLinks(
  app: NavAppKind,
  statsQuery: string = defaultStatsNavQuery()
): NavLinksBundle {
  const s = statsSuffix(statsQuery);

  if (app === "demo") {
    const base = "/demo";
    const main: NavLinkItem[] = [
      { href: `${base}${s}`, label: "Overview", shortLabel: "Home", icon: LayoutDashboard },
    ];
    const topRanked: NavLinkItem[] = [
      { href: `${base}/top-tracks${s}`, label: "Top tracks", shortLabel: "Tracks", icon: Music },
      { href: `${base}/top-artists${s}`, label: "Top artists", shortLabel: "Artists", icon: Mic2 },
      { href: `${base}/top-albums${s}`, label: "Top albums", shortLabel: "Albums", icon: Disc },
    ];
    const more: NavLinkItem[] = [];
    const all = [main[0]!, ...topRanked];
    return { main, topRanked, more, all };
  }

  const main: NavLinkItem[] = [
    { href: `/me${s}`, label: "Overview", shortLabel: "Home", icon: LayoutDashboard },
    { href: "/history/recent", label: "Recent", shortLabel: "Recent", icon: Clock3 },
  ];
  const topRanked: NavLinkItem[] = [
    { href: `/top-tracks${s}`, label: "Top tracks", shortLabel: "Tracks", icon: Music },
    { href: `/top-artists${s}`, label: "Top artists", shortLabel: "Artists", icon: Mic2 },
    { href: `/top-albums${s}`, label: "Top albums", shortLabel: "Albums", icon: Disc },
  ];
  const more: NavLinkItem[] = [
    { href: "/history/import", label: "Import", shortLabel: "Import", icon: Upload },
  ];
  const all = [main[0]!, main[1]!, ...topRanked, ...more];
  return { main, topRanked, more, all };
}

const staticQuery = defaultStatsNavQuery();
const staticBundle = createNavLinks("main", staticQuery);

/** Primary app destinations. */
export const NAV_LINKS_MAIN: NavLinkItem[] = staticBundle.main;

export const NAV_LINKS_TOP: NavLinkItem[] = staticBundle.topRanked;

/** Secondary — under “More” on desktop (unused when empty). */
export const NAV_LINKS_MORE: NavLinkItem[] = staticBundle.more;

export const NAV_LINKS: NavLinkItem[] = staticBundle.all;
