import type { Metadata } from "next";
import { GlossaryList } from "@/components/glossary/glossary-list";
import { SiteFooter } from "@/components/site-footer";
import { GLOSSARY } from "@/data/glossary";
import { isLocale } from "@/i18n/config";
import { getT } from "@/i18n/translate";

export async function generateMetadata({ params }: PageProps<"/[lang]/glossary">): Promise<Metadata> {
  const { lang } = await params;
  const t = getT(isLocale(lang) ? lang : "es");
  return {
    title: t("Glossary — Midterm Pulse 2026"),
    description: t("Plain-language definitions of the election and forecasting terms used across Midterm Pulse: generic ballot, tipping point, margin, win probability and more."),
  };
}

export default async function GlossaryPage({ params }: PageProps<"/[lang]/glossary">) {
  const { lang } = await params;
  const t = getT(isLocale(lang) ? lang : "es");
  return (
    <main className="page-main">
      <div className="content-shell glossary-shell">
        <section className="page-intro glossary-intro">
          <div><p className="eyebrow">{t("GLOSSARY · {count} TERMS", { count: GLOSSARY.length })}</p><h1>{t("Every term, in plain words.")}</h1><p>{t("What the numbers and labels on this site mean, with an example and a link to where you will meet each one.")}</p></div>
        </section>
        <GlossaryList terms={GLOSSARY} />
        <SiteFooter />
      </div>
    </main>
  );
}
