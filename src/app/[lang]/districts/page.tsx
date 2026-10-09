import type { Metadata } from "next";
import { DistrictMap } from "@/components/district-map";
import { SiteFooter } from "@/components/site-footer";
import { isLocale } from "@/i18n/config";
import { getT } from "@/i18n/translate";

export async function generateMetadata({ params }: PageProps<"/[lang]/districts">): Promise<Metadata> {
  const { lang } = await params;
  const t = getT(isLocale(lang) ? lang : "es");
  return { title: t("Congressional District Map — Midterm Pulse 2026"), description: t("Interactive 119th Congress district map with Midterm Pulse race forecasts.") };
}

export default function DistrictsPage() {
  return <main className="page-main"><div className="content-shell district-shell"><DistrictMap /><SiteFooter /></div></main>;
}
