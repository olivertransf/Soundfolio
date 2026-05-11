import { redirect } from "next/navigation";

/** Patterns live on the overview (`#patterns`); preserve query string for range. */
export default async function PatternsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(p)) {
    if (typeof value === "string" && value) qs.set(key, value);
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  redirect(`/me${suffix}#patterns`);
}
