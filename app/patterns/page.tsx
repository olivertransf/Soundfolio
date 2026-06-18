import { redirect } from "next/navigation";

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
  qs.set("section", "patterns");
  redirect(`/library?${qs.toString()}`);
}
