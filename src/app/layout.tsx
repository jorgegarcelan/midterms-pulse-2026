import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ContextBar } from "@/components/context-bar";
import { ElectionContextProvider } from "@/components/election-context";
import { MotionDirector } from "@/components/motion/motion-director";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";
import "./theme.css";
import "./motion.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  metadataBase: new URL("https://midterm-pulse-2026.vercel.app"),
  title: "Midterm Pulse 2026 — U.S. Election Forecast",
  description: "A transparent, data-driven forecast for the 2026 U.S. House and Senate elections.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Midterm Pulse 2026",
    description: "Forecasts, polls, live signals and electoral history for the 2026 U.S. midterms.",
    images: ["/brand/midterm-pulse-signal.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body><ElectionContextProvider><SiteHeader /><ContextBar />{children}<MotionDirector /></ElectionContextProvider></body>
    </html>
  );
}
