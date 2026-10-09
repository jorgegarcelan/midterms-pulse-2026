import type { Metadata } from "next";
import { ModelDashboard } from "@/components/model-dashboard";
import { SiteFooter } from "@/components/site-footer";
import { isLocale } from "@/i18n/config";
import { getT } from "@/i18n/translate";

export async function generateMetadata({ params }: PageProps<"/[lang]/model">): Promise<Metadata> {
  const { lang } = await params;
  const t = getT(isLocale(lang) ? lang : "es");
  return { title: t("Forecast Model — Midterm Pulse 2026"), description: t("Explore the assumptions and distributions behind the Midterm Pulse experimental forecast.") };
}

export default function ModelPage() {
  return <main className="page-main"><div className="content-shell model-shell"><ModelDashboard /><SiteFooter /></div></main>;
}
