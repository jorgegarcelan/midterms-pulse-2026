import type { Metadata } from "next";
import { CensusVsPollsPage } from "@/components/census/census-pages";
import { isLocale } from "@/i18n/config";
import { getT } from "@/i18n/translate";
import { loadCensusModel } from "@/lib/census-model";

export async function generateMetadata({ params }: PageProps<"/[lang]/census/vs-polls">): Promise<Metadata> {
  const { lang } = await params;
  const t = getT(isLocale(lang) ? lang : "es");
  return { title: t("Census-26 vs the polls — Midterm Pulse 2026"), description: t("Where Census-26 and MP-26, the poll-based forecast, disagree, district by district.") };
}

export default function Page() {
  return <CensusVsPollsPage data={loadCensusModel()} />;
}
