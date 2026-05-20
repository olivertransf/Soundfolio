"use client";

import { useEffect, useState } from "react";
import { BarChart3, Check, Monitor, Moon, Palette, Sparkles, Sun } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { syncViewerTimeZoneCookie } from "@/lib/viewer-timezone-client";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

type Accent = "green" | "blue" | "violet" | "sunset";
type Density = "cozy" | "compact";
type Theme = "dark" | "light" | "system";
type ChartMetricDefault = "minutes" | "streams" | "both";

type DisplayPreferences = {
  accent: Accent;
  density: Density;
  theme: Theme;
  chartMetric: ChartMetricDefault;
};

const STORAGE_KEY = "soundfolio:display-preferences";

const defaultPreferences: DisplayPreferences = {
  accent: "green",
  density: "cozy",
  theme: "dark",
  chartMetric: "minutes",
};

const accentOptions: Array<{ id: Accent; label: string; swatchClass: string }> = [
  { id: "green", label: "Spotify", swatchClass: "bg-[#1ed760]" },
  { id: "blue", label: "Ocean", swatchClass: "bg-[#38bdf8]" },
  { id: "violet", label: "Violet", swatchClass: "bg-[#8b5cf6]" },
  { id: "sunset", label: "Sunset", swatchClass: "bg-[#f97316]" },
];

const themeOptions: Array<{ id: Theme; label: string; icon: typeof Moon }> = [
  { id: "dark", label: "Dark", icon: Moon },
  { id: "light", label: "Light", icon: Sun },
  { id: "system", label: "System", icon: Monitor },
];

const chartMetricOptions: Array<{ id: ChartMetricDefault; label: string }> = [
  { id: "minutes", label: "Minutes" },
  { id: "streams", label: "Streams" },
  { id: "both", label: "Both" },
];

function applyPreferences(prefs: DisplayPreferences) {
  document.documentElement.dataset.accent = prefs.accent;
  document.documentElement.dataset.density = prefs.density;
  document.documentElement.dataset.chartMetric = prefs.chartMetric;

  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
  const dark = prefs.theme === "dark" || (prefs.theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = prefs.theme;
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
          theme:
            parsed.theme === "light" || parsed.theme === "system" || parsed.theme === "dark"
              ? parsed.theme
              : defaultPreferences.theme,
          chartMetric:
            parsed.chartMetric === "streams" || parsed.chartMetric === "both" || parsed.chartMetric === "minutes"
              ? parsed.chartMetric
              : defaultPreferences.chartMetric,
        };
        setPrefs(next);
        applyPreferences(next);
      } else {
        applyPreferences(defaultPreferences);
      }
    } catch {
      applyPreferences(defaultPreferences);
    }
    syncViewerTimeZoneCookie();
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
      <PopoverContent className="w-[22rem] gap-3 p-3">
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
            Theme
          </p>
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const active = prefs.theme === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs transition-colors",
                    active
                      ? "border-primary/60 bg-primary/10 text-foreground"
                      : "border-border/60 bg-secondary/20 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                  )}
                  onClick={() => setPrefs((prev) => ({ ...prev, theme: option.id }))}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {option.label}
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

        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" />
            Chart default
          </p>
          <div className="grid grid-cols-3 gap-2">
            {chartMetricOptions.map((option) => {
              const active = prefs.chartMetric === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={cn(
                    "rounded-lg border px-2.5 py-2 text-xs transition-colors",
                    active
                      ? "border-primary/60 bg-primary/10 text-foreground"
                      : "border-border/60 bg-secondary/20 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                  )}
                  onClick={() => setPrefs((prev) => ({ ...prev, chartMetric: option.id }))}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
