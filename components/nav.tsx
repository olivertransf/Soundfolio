"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Music, Mic2, History, Clock, Upload, Disc, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/me", label: "Overview", icon: LayoutDashboard },
  { href: "/me/top-tracks", label: "Top Tracks", icon: Music },
  { href: "/me/top-artists", label: "Top Artists", icon: Mic2 },
  { href: "/me/top-albums", label: "Top Albums", icon: Disc },
  { href: "/me/patterns", label: "Patterns", icon: Activity },
  { href: "/me/history", label: "History", icon: History },
  { href: "/me/recent", label: "Recent", icon: Clock },
  { href: "/me/import", label: "Import Data", icon: Upload },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="fixed left-0 top-0 h-full w-56 bg-card border-r border-border flex flex-col py-6 px-4 gap-1">
      <div className="mb-6 px-2">
        <span className="text-xl font-bold spotify-green">Spotify Stats</span>
      </div>
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            pathname === href
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
