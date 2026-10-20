import type { Metadata } from "next";
import { CensusExplainer } from "@/components/census/census-explainer";
import { SiteFooter } from "@/components/site-footer";
import { isLocale } from "@/i18n/config";
import { getT } from "@/i18n/translate";
import { loadCensusModel } from "@/lib/census-model";
import "./census.css";

export async function generateMetadata({ params }: PageProps<"/[lang]/census">): Promise<Metadata> {
  const { lang } = await params;
  const t = getT(isLocale(lang) ? lang : "es");
  return {
    title: t("Census-26: only the census — Midterm Pulse 2026"),
    description: t("A House forecast with no polls and no past votes: just who lives in each district. How it works, how it did, what it says about 2026 and what it cannot see."),
  };
}

export default function CensusPage() {
  return <main className="page-main"><div className="content-shell cz-shell"><nav className="model-tabs" aria-label="Census-26"><span className="model-tabs-title">Census-26</span></nav><CensusExplainer data={loadCensusModel()} /><SiteFooter /></div></main>;
}
