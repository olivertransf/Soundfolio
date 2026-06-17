import { DashboardShell } from "@/components/dashboard-shell";

export default function TopTracksLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
