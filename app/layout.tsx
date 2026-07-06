import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { PlayerProvider } from "@/components/PlayerProvider";
import { MotionInit } from "@/components/ReduceMotion";

const appSans = Figtree({
  variable: "--font-app-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Flow — focus sessions that quietly discover",
  description:
    "Consistent, non-disruptive focus sessions with a few taste-adjacent new tracks, recapped when your attention is free.",
};

export const viewport: Viewport = {
  themeColor: "#121212",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${appSans.variable} h-full antialiased`}>
      <body className="min-h-dvh">
        {/* Phone-width shell, centered — reads like the Spotify mobile app */}
        <MotionInit />
        <PlayerProvider>
          <div className="relative mx-auto flex min-h-dvh w-full max-w-[390px] flex-col bg-background">
            <main className="flex-1 pb-24">{children}</main>
            <BottomNav />
          </div>
        </PlayerProvider>
      </body>
    </html>
  );
}
