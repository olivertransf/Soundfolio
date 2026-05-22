import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isRequestAuthorized } from "@/lib/auth";

export function statsApiUnauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function requireStatsApiAuth(req: NextRequest): NextResponse | null {
  if (!isRequestAuthorized(req)) return statsApiUnauthorized();
  return null;
}
