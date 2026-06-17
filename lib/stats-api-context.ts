import type { NextRequest } from "next/server";
import { getStatsApiUser, requireStatsApiAuth } from "@/lib/stats-api-auth";

export async function requireAuthenticatedStatsRequest(req: NextRequest) {
  const denied = await requireStatsApiAuth(req);
  if (denied) return { denied, userId: undefined as string | undefined };

  const apiUser = await getStatsApiUser(req);
  const userId = apiUser?.isLegacy ? undefined : apiUser?.uid;
  return { denied: null, userId };
}
