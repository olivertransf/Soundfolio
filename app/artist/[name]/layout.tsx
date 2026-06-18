import { DashboardShell } from "@/components/dashboard-shell";

export default function ArtistLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
