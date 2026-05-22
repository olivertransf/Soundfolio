import { NextRequest, NextResponse } from "next/server";
import { getTopArtists } from "@/lib/stats";
import { requireStatsApiAuth } from "@/lib/stats-api-auth";
import {
  parseStatsRequestParams,
  parseStatsLimit,
  STATS_API_CACHE_HEADERS,
} from "@/lib/stats-api-params";

export async function GET(req: NextRequest) {
  const denied = requireStatsApiAuth(req);
  if (denied) return denied;

  const { filter, sortBy } = parseStatsRequestParams(req);
  const limit = parseStatsLimit(req);
  const items = await getTopArtists(limit, filter, "me", sortBy);

  return NextResponse.json(
    { filter: { label: filter.label }, sortBy, items },
    { headers: STATS_API_CACHE_HEADERS }
  );
}
