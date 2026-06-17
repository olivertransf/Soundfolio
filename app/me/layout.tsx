import { DashboardShell } from "@/components/dashboard-shell";

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
