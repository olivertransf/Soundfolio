import { DashboardShell } from "@/components/dashboard-shell";

export default function AlbumLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
