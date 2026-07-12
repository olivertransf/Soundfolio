"use client";

import { useEffect, useState } from "react";
import { Check, Monitor, Moon, Palette, Sun } from "lucide-react";
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
import {
  accentOptions,
  applyDisplayPreferences,
  defaultDisplayPreferences,
  loadDisplayPreferences,
  saveDisplayPreferences,
  type DisplayPreferences,
  type PrefsSetter,
} from "@/lib/display-preferences";

const themeIcons = {
  dark: Moon,
  light: Sun,
  system: Monitor,
} as const;

function PrefButton({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-11 items-center justify-center gap-1.5 border px-2.5 py-2 text-xs transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-secondary/20 text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
        className
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function DisplayPreferencesForm({
  prefs,
  setPrefs,
}: {
  prefs: DisplayPreferences;
  setPrefs: PrefsSetter;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Accent
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {accentOptions.map((option) => {
            const active = prefs.accent === option.id;
            return (
              <PrefButton
                key={option.id}
                active={active}
                className="justify-start"
                onClick={() => setPrefs((prev) => ({ ...prev, accent: option.id }))}
              >
                <span className={cn("h-3 w-3 shrink-0 rounded-full", option.swatchClass)} />
                <span className="flex-1 text-left">{option.label}</span>
                {active ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
              </PrefButton>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Theme
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(["dark", "light", "system"] as const).map((id) => {
            const Icon = themeIcons[id];
            const active = prefs.theme === id;
            return (
              <PrefButton
                key={id}
                active={active}
                onClick={() => setPrefs((prev) => ({ ...prev, theme: id }))}
              >
                <Icon className="h-3.5 w-3.5" />
                {id === "dark" ? "Dark" : id === "light" ? "Light" : "System"}
              </PrefButton>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Density
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(["cozy", "compact"] as const).map((density) => (
              <PrefButton
                key={density}
                active={prefs.density === density}
                onClick={() => setPrefs((prev) => ({ ...prev, density }))}
              >
                {density === "cozy" ? "Cozy" : "Compact"}
              </PrefButton>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Corners
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(["sharp", "soft", "round"] as const).map((radius) => (
              <PrefButton
                key={radius}
                active={prefs.radius === radius}
                onClick={() => setPrefs((prev) => ({ ...prev, radius }))}
              >
                {radius === "sharp" ? "Sharp" : radius === "soft" ? "Soft" : "Round"}
              </PrefButton>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Artwork
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(["show", "hide"] as const).map((artwork) => (
              <PrefButton
                key={artwork}
                active={prefs.artwork === artwork}
                onClick={() => setPrefs((prev) => ({ ...prev, artwork }))}
              >
                {artwork === "show" ? "Show" : "Hide"}
              </PrefButton>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Time
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(["absolute", "relative"] as const).map((timeDisplay) => (
              <PrefButton
                key={timeDisplay}
                active={prefs.timeDisplay === timeDisplay}
                onClick={() => setPrefs((prev) => ({ ...prev, timeDisplay }))}
              >
                {timeDisplay === "absolute" ? "Clock" : "Relative"}
              </PrefButton>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function useDisplayPreferencesState() {
  const [prefs, setPrefs] = useState<DisplayPreferences>(defaultDisplayPreferences);

  useEffect(() => {
    const next = loadDisplayPreferences();
    setPrefs(next);
    applyDisplayPreferences(next);
    syncViewerTimeZoneCookie();

    const sync = () => {
      const next = loadDisplayPreferences();
      setPrefs((prev) =>
        JSON.stringify(prev) === JSON.stringify(next) ? prev : next
      );
    };
    window.addEventListener("storage", sync);
    window.addEventListener("soundfolio:prefs", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("soundfolio:prefs", sync);
    };
  }, []);

  useEffect(() => {
    applyDisplayPreferences(prefs);
    saveDisplayPreferences(prefs);
  }, [prefs]);

  return { prefs, setPrefs };
}

export function DisplayPreferencesPanel() {
  const { prefs, setPrefs } = useDisplayPreferencesState();
  return <DisplayPreferencesForm prefs={prefs} setPrefs={setPrefs} />;
}

export function DisplayPreferences() {
  const { prefs, setPrefs } = useDisplayPreferencesState();

  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label="Display settings"
        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
      >
        <Palette className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,22rem)] gap-3 p-3">
        <PopoverHeader className="mb-1">
          <PopoverTitle className="text-sm">Display</PopoverTitle>
        </PopoverHeader>
        <DisplayPreferencesForm prefs={prefs} setPrefs={setPrefs} />
      </PopoverContent>
    </Popover>
  );
}
