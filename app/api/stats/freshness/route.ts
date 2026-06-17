import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedStatsRequest } from "@/lib/stats-api-context";
import { getLatestPlayAt } from "@/lib/stats";

export async function GET(req: NextRequest) {
  const { denied, userId } = await requireAuthenticatedStatsRequest(req);
  if (denied) return denied;

  const latestPlayAt = await getLatestPlayAt("me", userId);
  return NextResponse.json({
    latestPlayAt: latestPlayAt?.toISOString() ?? null,
    checkedAt: new Date().toISOString(),
  });
}
