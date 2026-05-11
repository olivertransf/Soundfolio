"use client";

import { useEffect, useState } from "react";
import { Check, Palette, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  VIEWER_TIMEZONE_COOKIE,
  VIEWER_TIMEZONE_PARAM,
  isValidTimeZone,
} from "@/lib/stats-timezone";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

type Accent = "green" | "blue" | "violet" | "sunset";
type Density = "cozy" | "compact";

type DisplayPreferences = {
  accent: Accent;
  density: Density;
};

const STORAGE_KEY = "soundfolio:display-preferences";

const defaultPreferences: DisplayPreferences = {
  accent: "green",
  density: "cozy",
};

const accentOptions: Array<{ id: Accent; label: string; swatchClass: string }> = [
  { id: "green", label: "Spotify", swatchClass: "bg-[#1ed760]" },
  { id: "blue", label: "Ocean", swatchClass: "bg-[#38bdf8]" },
  { id: "violet", label: "Violet", swatchClass: "bg-[#8b5cf6]" },
  { id: "sunset", label: "Sunset", swatchClass: "bg-[#f97316]" },
];

function applyPreferences(prefs: DisplayPreferences) {
  document.documentElement.dataset.accent = prefs.accent;
  document.documentElement.dataset.density = prefs.density;
}

function setTimeZoneCookie() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!isValidTimeZone(tz)) return;
    document.cookie = `${VIEWER_TIMEZONE_COOKIE}=${encodeURIComponent(
      tz
    )}; Max-Age=31536000; Path=/; SameSite=Lax`;

    // Keep links shareable and API calls coherent when user reloads quickly.
    const url = new URL(window.location.href);
    if (url.searchParams.get(VIEWER_TIMEZONE_PARAM) !== tz) {
      url.searchParams.set(VIEWER_TIMEZONE_PARAM, tz);
      window.history.replaceState({}, "", url);
    }
  } catch {
    // no-op
  }
}

export function DisplayPreferences() {
  const [prefs, setPrefs] = useState<DisplayPreferences>(defaultPreferences);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<DisplayPreferences>;
        const next: DisplayPreferences = {
          accent:
            parsed.accent && accentOptions.some((option) => option.id === parsed.accent)
              ? parsed.accent
              : defaultPreferences.accent,
          density: parsed.density === "compact" ? "compact" : "cozy",
        };
        setPrefs(next);
        applyPreferences(next);
      } else {
        applyPreferences(defaultPreferences);
      }
    } catch {
      applyPreferences(defaultPreferences);
    }
    setTimeZoneCookie();
  }, []);

  useEffect(() => {
    applyPreferences(prefs);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // no-op
    }
  }, [prefs]);

  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label="Display settings"
        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
      >
        <Palette className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent className="w-[20rem] gap-3 p-3">
        <PopoverHeader className="mb-1">
          <PopoverTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            Customize look
          </PopoverTitle>
        </PopoverHeader>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Accent
          </p>
          <div className="grid grid-cols-2 gap-2">
            {accentOptions.map((option) => {
              const active = prefs.accent === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors",
                    active
                      ? "border-primary/60 bg-primary/10 text-foreground"
                      : "border-border/60 bg-secondary/20 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                  )}
                  onClick={() => setPrefs((prev) => ({ ...prev, accent: option.id }))}
                >
                  <span className={cn("h-3 w-3 rounded-full", option.swatchClass)} />
                  <span className="flex-1">{option.label}</span>
                  {active ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Density
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={cn(
                "rounded-lg border px-2.5 py-2 text-xs transition-colors",
                prefs.density === "cozy"
                  ? "border-primary/60 bg-primary/10 text-foreground"
                  : "border-border/60 bg-secondary/20 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
              )}
              onClick={() => setPrefs((prev) => ({ ...prev, density: "cozy" }))}
            >
              Cozy
            </button>
            <button
              type="button"
              className={cn(
                "rounded-lg border px-2.5 py-2 text-xs transition-colors",
                prefs.density === "compact"
                  ? "border-primary/60 bg-primary/10 text-foreground"
                  : "border-border/60 bg-secondary/20 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
              )}
              onClick={() => setPrefs((prev) => ({ ...prev, density: "compact" }))}
            >
              Compact
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
