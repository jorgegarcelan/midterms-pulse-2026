import type { Metadata } from "next";
import { Suspense } from "react";
import { CandidatesDirectory } from "@/components/candidates/candidates-directory";
import { SiteFooter } from "@/components/site-footer";
import { isLocale } from "@/i18n/config";
import { getT } from "@/i18n/translate";

export async function generateMetadata({ params }: PageProps<"/[lang]/candidates">): Promise<Metadata> {
  const { lang } = await params;
  const t = getT(isLocale(lang) ? lang : "es");
  const title = t("2026 candidates — Midterm Pulse 2026");
  const description = t("Every general-election nominee for the U.S. House and Senate on 3 November 2026, with each race's forecast and expert ratings.");
  return { title, description, openGraph: { title, description }, alternates: { languages: { es: "/candidates", en: "/en/candidates" } } };
}

export default function CandidatesPage() {
  // The directory reads its filters from the query string, so it renders inside a Suspense boundary.
  return <main className="page-main"><div className="content-shell cand-shell"><Suspense><CandidatesDirectory /></Suspense><SiteFooter /></div></main>;
}
