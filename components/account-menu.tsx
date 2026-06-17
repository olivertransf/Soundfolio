"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";

export function AccountMenu() {
  const router = useRouter();
  const { user, configured, signOutUser } = useAuth();

  if (!configured || !user) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="shrink-0"
      aria-label="Sign out"
      onClick={() => {
        void (async () => {
          await signOutUser();
          router.push("/auth");
          router.refresh();
        })();
      }}
    >
      <LogOut className="h-4 w-4" />
    </Button>
  );
}
