"use client";

import { useEffect, useState } from "react";
import {
  detectViewerTimeZone,
  readViewerTimeZoneCookie,
} from "@/lib/viewer-timezone-client";

export function useViewerTimeZone() {
  const [timeZone, setTimeZone] = useState("UTC");

  useEffect(() => {
    setTimeZone(readViewerTimeZoneCookie() ?? detectViewerTimeZone() ?? "UTC");
  }, []);

  return timeZone;
}
