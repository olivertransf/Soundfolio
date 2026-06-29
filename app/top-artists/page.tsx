import { redirect } from "next/navigation";

export default function TopArtistsPage() {
  redirect("/library?section=rankings");
}
