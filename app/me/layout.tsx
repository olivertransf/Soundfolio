import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const AUTH_COOKIE = "stats_auth";

export const dynamic = "force-dynamic";

export default async function MeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const key = process.env.AUTH_KEY;
  if (!key) return <>{children}</>;

  const cookieStore = await cookies();
  const cookie = cookieStore.get(AUTH_COOKIE)?.value;
  if (cookie !== key) {
    redirect("/auth");
  }

  return <>{children}</>;
}
