import { requireOnboardedSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function MeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOnboardedSession("/me");
  return <>{children}</>;
}
