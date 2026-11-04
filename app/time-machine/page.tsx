import { Suspense } from "react";
import { ArchiveExperience } from "@/components/archive/archive-experience";
export default function TimeMachinePage() {
  return (
    <Suspense fallback={<p>Opening your archive…</p>}>
      <ArchiveExperience />
    </Suspense>
  );
}
