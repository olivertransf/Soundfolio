"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { syncViewerTimeZoneCookie } from "@/lib/viewer-timezone-client";

/** Sets `soundfolio_tz` on load so server charts bucket in the viewer's timezone. */
export function ViewerTimezoneSync() {
  const router = useRouter();
  const refreshed = useRef(false);

  useEffect(() => {
    const changed = syncViewerTimeZoneCookie();
    if (changed && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [router]);

  return null;
}
