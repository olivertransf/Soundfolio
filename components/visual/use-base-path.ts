"use client";

import { usePathname } from "next/navigation";

export function useBasePath() {
  const pathname = usePathname();
  return pathname.startsWith("/demo") ? "/demo" : "";
}
