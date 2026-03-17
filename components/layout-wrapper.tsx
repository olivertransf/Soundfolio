"use client";

import { usePathname } from "next/navigation";
import { Nav } from "@/components/nav";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = pathname === "/auth";

  if (isAuth) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Nav />
      <main className="flex-1 ml-56 p-8">{children}</main>
    </div>
  );
}
