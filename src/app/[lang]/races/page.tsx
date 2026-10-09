import type { Metadata } from "next";
import { RacesExplorer } from "@/components/races-explorer";
import { SiteFooter } from "@/components/site-footer";
import { isLocale } from "@/i18n/config";
import { getT } from "@/i18n/translate";

export async function generateMetadata({ params }: PageProps<"/[lang]/races">): Promise<Metadata> {
  const { lang } = await params;
  const t = getT(isLocale(lang) ? lang : "es");
  return { title: t("Race Directory — Midterm Pulse 2026"), description: t("Search every modeled 2026 U.S. House and Senate race.") };
}

export default function RacesPage() {
  return <main className="page-main"><div className="content-shell races-shell"><RacesExplorer /><SiteFooter /></div></main>;
}
