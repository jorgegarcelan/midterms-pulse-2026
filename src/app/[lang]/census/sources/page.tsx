import type { Metadata } from "next";
import { CensusSourcesPage } from "@/components/census/census-pages";
import { isLocale } from "@/i18n/config";
import { getT } from "@/i18n/translate";
import { loadCensusModel } from "@/lib/census-model";

export async function generateMetadata({ params }: PageProps<"/[lang]/census/sources">): Promise<Metadata> {
  const { lang } = await params;
  const t = getT(isLocale(lang) ? lang : "es");
  return { title: t("Census-26 sources — Midterm Pulse 2026"), description: t("Data sources and pipeline behind Census-26.") };
}

export default function Page() {
  return <CensusSourcesPage data={loadCensusModel()} />;
}
