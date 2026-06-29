import { redirect } from "next/navigation";

export default function TopAlbumsPage() {
  redirect("/library?section=rankings");
}
