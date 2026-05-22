import { NextRequest, NextResponse } from "next/server";
import { requireStatsApiAuth } from "@/lib/stats-api-auth";
import { getLatestPlayAt } from "@/lib/stats";

export async function GET(req: NextRequest) {
  const denied = requireStatsApiAuth(req);
  if (denied) return denied;

  const latestPlayAt = await getLatestPlayAt("me");
  return NextResponse.json({
    latestPlayAt: latestPlayAt?.toISOString() ?? null,
    checkedAt: new Date().toISOString(),
  });
}
