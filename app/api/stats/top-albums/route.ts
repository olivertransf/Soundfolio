import { NextRequest, NextResponse } from "next/server";
import { getTopAlbums } from "@/lib/stats";
import { requireAuthenticatedStatsRequest } from "@/lib/stats-api-context";
import {
  parseStatsRequestParams,
  parseStatsLimit,
  STATS_API_CACHE_HEADERS,
} from "@/lib/stats-api-params";

export async function GET(req: NextRequest) {
  const { denied, userId } = await requireAuthenticatedStatsRequest(req);
  if (denied) return denied;

  const { filter, sortBy } = parseStatsRequestParams(req);
  const limit = parseStatsLimit(req);
  const items = await getTopAlbums(limit, filter, "me", sortBy, userId);

  return NextResponse.json(
    { filter: { label: filter.label }, sortBy, items },
    { headers: STATS_API_CACHE_HEADERS }
  );
}
