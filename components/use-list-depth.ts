"use client";

import { useViewportWidth } from "@/hooks/use-media-query";
import { useEffect, useState } from "react";
import { listDepthLimits, loadDisplayPreferences, type ListDepth } from "@/lib/display-preferences";

export function useListDepth() {
  const [depth, setDepth] = useState<ListDepth>("standard");

  useEffect(() => {
    const sync = () => setDepth(loadDisplayPreferences().listDepth);
    sync();
    window.addEventListener("soundfolio:prefs", sync);
    return () => window.removeEventListener("soundfolio:prefs", sync);
  }, []);

  const width = useViewportWidth();
  const limits = listDepthLimits[depth];
  if (width >= 768) return limits;
  return {
    ...limits,
    dashboard: depth === "deep" ? 10 : 5,
    dashboardRecent: depth === "deep" ? 10 : 5,
    page: depth === "deep" ? 20 : 10,
  };
}
