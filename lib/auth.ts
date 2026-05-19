import type { NextRequest } from "next/server";

export const AUTH_COOKIE = "soundfolio_auth";

export function isRequestAuthorized(request: NextRequest) {
  const key = process.env.AUTH_KEY;
  if (!key) return true;

  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  const queryKey = request.nextUrl.searchParams.get("key");
  const bearer = request.headers.get("authorization");
  const headerKey = request.headers.get("x-soundfolio-key");
  const cronSecret = process.env.CRON_SECRET;

  return (
    cookie === key ||
    queryKey === key ||
    headerKey === key ||
    bearer === `Bearer ${key}` ||
    (cronSecret ? bearer === `Bearer ${cronSecret}` : false)
  );
}
