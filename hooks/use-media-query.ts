"use client";

import { useSyncExternalStore } from "react";

function subscribeResize(cb: () => void) {
  window.addEventListener("resize", cb);
  window.visualViewport?.addEventListener("resize", cb);
  return () => {
    window.removeEventListener("resize", cb);
    window.visualViewport?.removeEventListener("resize", cb);
  };
}

function getWidthSnapshot() {
  return typeof window !== "undefined" ? window.innerWidth : 1024;
}

function getServerSnapshot() {
  return 1024;
}

/** Current viewport width; server/initial snapshot is 1024 to match lg layout. */
export function useViewportWidth() {
  return useSyncExternalStore(subscribeResize, getWidthSnapshot, getServerSnapshot);
}

export function useIsNarrowChart() {
  const w = useViewportWidth();
  return w < 560;
}
