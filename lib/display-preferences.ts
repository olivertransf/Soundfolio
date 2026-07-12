import type { Dispatch, SetStateAction } from "react";

export type Accent = "green" | "blue" | "violet" | "sunset" | "rose" | "teal" | "mono";
export type Density = "cozy" | "compact";
export type Theme = "dark" | "light" | "system";
export type Radius = "sharp" | "soft" | "round";
export type ArtworkPref = "show" | "hide";
export type TimeDisplay = "absolute" | "relative";

export type DisplayPreferences = {
  accent: Accent;
  density: Density;
  theme: Theme;
  radius: Radius;
  artwork: ArtworkPref;
  timeDisplay: TimeDisplay;
};

export const DISPLAY_PREFS_STORAGE_KEY = "soundfolio:display-preferences";

export const defaultDisplayPreferences: DisplayPreferences = {
  accent: "green",
  density: "cozy",
  theme: "dark",
  radius: "soft",
  artwork: "show",
  timeDisplay: "absolute",
};

export const accentOptions: Array<{ id: Accent; label: string; swatchClass: string }> = [
  { id: "green", label: "Spotify", swatchClass: "bg-[#1ed760]" },
  { id: "blue", label: "Ocean", swatchClass: "bg-[#38bdf8]" },
  { id: "violet", label: "Violet", swatchClass: "bg-[#8b5cf6]" },
  { id: "sunset", label: "Sunset", swatchClass: "bg-[#f97316]" },
  { id: "rose", label: "Rose", swatchClass: "bg-[#fb7185]" },
  { id: "teal", label: "Teal", swatchClass: "bg-[#2dd4bf]" },
  { id: "mono", label: "Mono", swatchClass: "bg-[#a1a1aa]" },
];

export const themeOptions: Array<{ id: Theme; label: string }> = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "system", label: "System" },
];

export const densityOptions: Array<{ id: Density; label: string }> = [
  { id: "cozy", label: "Cozy" },
  { id: "compact", label: "Compact" },
];

export const radiusOptions: Array<{ id: Radius; label: string }> = [
  { id: "sharp", label: "Sharp" },
  { id: "soft", label: "Soft" },
  { id: "round", label: "Round" },
];

export const artworkOptions: Array<{ id: ArtworkPref; label: string }> = [
  { id: "show", label: "Show" },
  { id: "hide", label: "Hide" },
];

export const timeDisplayOptions: Array<{ id: TimeDisplay; label: string }> = [
  { id: "absolute", label: "Clock" },
  { id: "relative", label: "Relative" },
];

export function parseDisplayPreferences(
  raw: Partial<DisplayPreferences> | null | undefined
): DisplayPreferences {
  return {
    accent: accentOptions.some((o) => o.id === raw?.accent)
      ? (raw!.accent as Accent)
      : defaultDisplayPreferences.accent,
    density: raw?.density === "compact" ? "compact" : "cozy",
    theme:
      raw?.theme === "light" || raw?.theme === "system" || raw?.theme === "dark"
        ? raw.theme
        : defaultDisplayPreferences.theme,
    radius:
      raw?.radius === "sharp" || raw?.radius === "round" || raw?.radius === "soft"
        ? raw.radius
        : defaultDisplayPreferences.radius,
    artwork: raw?.artwork === "hide" ? "hide" : "show",
    timeDisplay: raw?.timeDisplay === "relative" ? "relative" : "absolute",
  };
}

export function applyDisplayPreferences(prefs: DisplayPreferences) {
  const root = document.documentElement;
  root.dataset.accent = prefs.accent;
  root.dataset.density = prefs.density;
  root.dataset.radius = prefs.radius;
  root.dataset.artwork = prefs.artwork;
  root.dataset.timeDisplay = prefs.timeDisplay;
  delete root.dataset.chartMetric;

  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
  const dark = prefs.theme === "dark" || (prefs.theme === "system" && prefersDark);
  root.classList.toggle("dark", dark);
  root.dataset.theme = prefs.theme;
}

export function loadDisplayPreferences(): DisplayPreferences {
  try {
    const raw = window.localStorage.getItem(DISPLAY_PREFS_STORAGE_KEY);
    if (!raw) return defaultDisplayPreferences;
    return parseDisplayPreferences(JSON.parse(raw) as Partial<DisplayPreferences>);
  } catch {
    return defaultDisplayPreferences;
  }
}

export function saveDisplayPreferences(prefs: DisplayPreferences) {
  try {
    window.localStorage.setItem(DISPLAY_PREFS_STORAGE_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new Event("soundfolio:prefs"));
  } catch {
    // no-op
  }
}

export type PrefsSetter = Dispatch<SetStateAction<DisplayPreferences>>;
