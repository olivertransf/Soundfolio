import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { SyncOnLoad } from "@/components/sync-on-load";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-display",
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
        className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} font-sans antialiased min-h-dvh min-h-screen min-w-0 overflow-x-hidden pb-[env(safe-area-inset-bottom,0px)] [-webkit-tap-highlight-color:transparent]`}
      >
        <SyncOnLoad />
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  );
}
