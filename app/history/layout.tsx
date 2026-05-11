import { HistorySubnav } from "@/components/history-subnav";

export default function HistoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <HistorySubnav />
      {children}
    </div>
  );
}
