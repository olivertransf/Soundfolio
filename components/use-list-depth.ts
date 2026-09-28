"use client";

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

  return listDepthLimits[depth];
}
