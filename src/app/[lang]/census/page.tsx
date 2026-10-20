import type { Metadata } from "next";
import { CensusForecastPage } from "@/components/census/census-pages";
import { isLocale } from "@/i18n/config";
import { getT } from "@/i18n/translate";
import { loadCensusModel } from "@/lib/census-model";

export async function generateMetadata({ params }: PageProps<"/[lang]/census">): Promise<Metadata> {
  const { lang } = await params;
  const t = getT(isLocale(lang) ? lang : "es");
  return { title: t("Census-26: only the census — Midterm Pulse 2026"), description: t("A House and Senate forecast with no polls and no past votes: just who lives in each district. The 2026 seats, district by district and state by state.") };
}

export default function Page() {
  return <CensusForecastPage data={loadCensusModel()} />;
}
