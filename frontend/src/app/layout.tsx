import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import PWARegister from "@/components/PWARegister";
import OfflineIndicator from "@/components/OfflineIndicator";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Smart Reminder",
  description: "An offline-first scheduling assistant with web push reminders.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Smart Reminder",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-[#f0f2f5] text-slate-800 antialiased">
      <body className={`${inter.className} min-h-full flex flex-col`}>
        <PWARegister />
        <OfflineIndicator />
        <main className="flex-1 w-full max-w-md mx-auto bg-[#f0f2f5] min-h-screen shadow-md border-x border-slate-200 pb-16 relative">
          {children}
        </main>
      </body>
    </html>
  );
}
