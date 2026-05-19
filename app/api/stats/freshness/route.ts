import { NextResponse } from "next/server";
import { getLatestPlayAt } from "@/lib/stats";

export async function GET() {
  const latestPlayAt = await getLatestPlayAt("me");
  return NextResponse.json({
    latestPlayAt: latestPlayAt?.toISOString() ?? null,
    checkedAt: new Date().toISOString(),
  });
}
