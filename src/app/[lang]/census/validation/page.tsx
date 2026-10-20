import type { Metadata } from "next";
import { CensusValidationPage } from "@/components/census/census-pages";
import { isLocale } from "@/i18n/config";
import { getT } from "@/i18n/translate";
import { loadCensusModel } from "@/lib/census-model";

export async function generateMetadata({ params }: PageProps<"/[lang]/census/validation">): Promise<Metadata> {
  const { lang } = await params;
  const t = getT(isLocale(lang) ? lang : "es");
  return { title: t("Census-26 validation — Midterm Pulse 2026"), description: t("How the census-only model did on the House and Senate elections of 2016–2024, each predicted blind.") };
}

export default function Page() {
  return <CensusValidationPage data={loadCensusModel()} />;
}
