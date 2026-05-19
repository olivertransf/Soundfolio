import { redirect } from "next/navigation";

export default function HistoryPage() {
  redirect("/me?range=ytd");
}
