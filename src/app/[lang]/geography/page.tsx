import type { Metadata } from "next";
import { GeographyStory } from "@/components/geography/geography-story";
import { SiteFooter } from "@/components/site-footer";
import { isLocale } from "@/i18n/config";
import { getT } from "@/i18n/translate";

export async function generateMetadata({ params }: PageProps<"/[lang]/geography">): Promise<Metadata> {
  const { lang } = await params;
  const t = getT(isLocale(lang) ? lang : "es");
  return { title: t("The geography of the vote — Midterm Pulse 2026"), description: t("City vs countryside, education, race, income, the belts and the regions: how America's map really votes, county by county.") };
}

export default async function GeographyPage({ params }: PageProps<"/[lang]/geography">) {
  const { lang } = await params;
  const t = getT(isLocale(lang) ? lang : "es");
  return <main className="page-main"><div className="content-shell geo-shell">
    <section className="page-intro"><div>
      <p className="eyebrow">{t("GEOGRAPHY · 3,100 COUNTIES")}</p>
      <h1>{t("The geography of the vote")}</h1>
      <p>{t("Seven axes to understand how the United States votes: city and countryside, degrees, race, money, the belts, the regions and the swing. Scroll, hover the charts, or press Present to walk through it on stream.")}</p>
    </div></section>
    <GeographyStory />
    <SiteFooter />
  </div></main>;
}
