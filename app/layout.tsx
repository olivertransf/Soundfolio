import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { ViewerTimezoneSync } from "@/components/viewer-timezone-sync";
import { AuthProvider } from "@/components/auth-provider";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Soundfolio",
  description: "Self-hosted listening history and stats",
  appleWebApp: {
    capable: true,
    title: "Soundfolio",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark overflow-x-hidden">
      <body
        className={`${jetbrainsMono.variable} font-mono antialiased min-h-dvh min-h-screen min-w-0 overflow-x-hidden pb-[env(safe-area-inset-bottom,0px)] [-webkit-tap-highlight-color:transparent]`}
      >
        <AuthProvider>
          <ViewerTimezoneSync />
          <LayoutWrapper>{children}</LayoutWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
