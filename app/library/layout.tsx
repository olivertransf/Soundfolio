import { DashboardShell } from "@/components/dashboard-shell";

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
