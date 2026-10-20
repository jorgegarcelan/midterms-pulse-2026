import type { Metadata } from "next";
import { GerrymanderExplainer } from "@/components/gerrymander/gerrymander-explainer";
import { SiteFooter } from "@/components/site-footer";
import { isLocale } from "@/i18n/config";
import { getT } from "@/i18n/translate";
import { loadCityCases, loadShapes } from "@/lib/gerrymander-geo";
import "./gerrymandering.css";

export async function generateMetadata({ params }: PageProps<"/[lang]/gerrymandering">): Promise<Metadata> {
  const { lang } = await params;
  const t = getT(isLocale(lang) ? lang : "es");
  return {
    title: t("Gerrymandering, explained — Midterm Pulse 2026"),
    description: t("Draw the districts yourself: how packing and cracking turn 40% of the votes into a majority, how it gets caught, and the 2026 map war."),
  };
}

export default async function GerrymanderingPage() {
  const [shapes, cities] = await Promise.all([loadShapes(), loadCityCases()]);
  return <main className="page-main"><div className="content-shell gm-shell"><GerrymanderExplainer shapes={shapes} cities={cities} /><SiteFooter /></div></main>;
}
