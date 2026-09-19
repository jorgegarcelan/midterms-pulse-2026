import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

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
    <html lang="en">
      <body><SiteHeader />{children}</body>
    </html>
  );
}
