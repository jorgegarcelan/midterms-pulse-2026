import type { Metadata } from "next";
import { CensusHowPage } from "@/components/census/census-pages";
import { isLocale } from "@/i18n/config";
import { getT } from "@/i18n/translate";
import { loadCensusModel } from "@/lib/census-model";

export async function generateMetadata({ params }: PageProps<"/[lang]/census/how-it-works">): Promise<Metadata> {
  const { lang } = await params;
  const t = getT(isLocale(lang) ? lang : "es");
  return { title: t("How Census-26 works — Midterm Pulse 2026"), description: t("The 22 census variables, how they map to votes, twin districts, a model you can play with and the national mood.") };
}

export default function Page() {
  return <CensusHowPage data={loadCensusModel()} />;
}
