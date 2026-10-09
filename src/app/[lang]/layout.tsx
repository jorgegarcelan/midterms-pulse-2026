import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { CommandPalette } from "@/components/command-palette";
import { ElectionContextProvider } from "@/components/election-context";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { MotionDirector } from "@/components/motion/motion-director";
import { SiteChrome } from "@/components/site-chrome";
import { isLocale, LOCALES } from "@/i18n/config";
import { getT } from "@/i18n/translate";
import "../globals.css";
import "../theme.css";
import "../motion.css";
import "../features.css";
import "../explainer.css";
import "../race-data.css";
import "../live.css";
import "../night.css";
import "../stream.css";
import "../changes.css";
import "../geography.css";
import "../nav.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const dynamicParams = false;
export const generateStaticParams = () => LOCALES.map((lang) => ({ lang }));

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const t = getT(isLocale(lang) ? lang : "es");
  return {
    metadataBase: new URL("https://midterm-pulse-2026.vercel.app"),
    title: t("Midterm Pulse 2026 — U.S. Election Forecast"),
    description: t("A transparent, data-driven forecast for the 2026 U.S. House and Senate elections."),
    alternates: { languages: { es: "/", en: "/en" } },
    openGraph: {
      title: "Midterm Pulse 2026",
      description: t("Forecasts, polls, live signals and electoral history for the 2026 U.S. midterms."),
      siteName: "Midterm Pulse 2026",
      type: "website",
      locale: lang === "en" ? "en_US" : "es_ES",
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <html lang={lang} className={`${geist.variable} ${geistMono.variable}`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body><LocaleProvider locale={lang}><ElectionContextProvider><SiteChrome />{children}<MotionDirector /><CommandPalette /></ElectionContextProvider></LocaleProvider><Analytics /></body>
    </html>
  );
}
