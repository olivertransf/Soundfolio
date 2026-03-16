"use client";

import { useEffect, useRef } from "react";

export function SyncOnLoad() {
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;
    fetch("/api/sync-lastfm", { method: "POST" }).catch(() => {});
  }, []);

  return null;
}
