import { DashboardShell } from "@/components/dashboard-shell";

export default function EntityLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
