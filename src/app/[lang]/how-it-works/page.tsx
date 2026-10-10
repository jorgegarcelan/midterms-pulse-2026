import type { Metadata } from "next";
import { ModelExplainer } from "@/components/explainer/model-explainer";
import { SiteFooter } from "@/components/site-footer";
import { ModelTabs } from "@/components/model/model-tabs";
import { isLocale } from "@/i18n/config";
import { getT } from "@/i18n/translate";

export async function generateMetadata({ params }: PageProps<"/[lang]/how-it-works">): Promise<Metadata> {
  const { lang } = await params;
  const t = getT(isLocale(lang) ? lang : "es");
  return {
    title: t("How the Model Works — Midterm Pulse 2026"),
    description: t("The MP-26 forecast pipeline step by step: inputs, poll weighting, movement, race odds, error budget, 50,000 simulations and outputs."),
  };
}

export default function HowItWorksPage() {
  return <main className="page-main"><div className="content-shell explainer-shell"><ModelTabs /><ModelExplainer /><SiteFooter /></div></main>;
}
