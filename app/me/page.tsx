import { Suspense } from "react";
import { OverviewContent } from "@/components/me/overview-content";

export default function OverviewPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">Loading…</div>}>
      <OverviewContent />
    </Suspense>
  );
}
