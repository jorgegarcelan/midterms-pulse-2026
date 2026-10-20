import type { Metadata } from "next";
import { CensusLimitsPage } from "@/components/census/census-pages";
import { isLocale } from "@/i18n/config";
import { getT } from "@/i18n/translate";
import { loadCensusModel } from "@/lib/census-model";

export async function generateMetadata({ params }: PageProps<"/[lang]/census/limits">): Promise<Metadata> {
  const { lang } = await params;
  const t = getT(isLocale(lang) ? lang : "es");
  return { title: t("Census-26 limits — Midterm Pulse 2026"), description: t("What a census-only model cannot see: gerrymanders, candidates and the size of the wave.") };
}

export default function Page() {
  return <CensusLimitsPage data={loadCensusModel()} />;
}
