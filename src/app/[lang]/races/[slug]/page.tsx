import type { Metadata } from "next";
import { RaceProfile } from "@/components/race-profile";
import { SiteFooter } from "@/components/site-footer";
import { isLocale } from "@/i18n/config";
import { getT } from "@/i18n/translate";
import { parseRaceSlug, raceName } from "@/lib/races";

export async function generateMetadata({ params }: PageProps<"/[lang]/races/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  const t = getT(isLocale(lang) ? lang : "es");
  const parsed = parseRaceSlug(slug);
  const name = parsed ? raceName(parsed, t) : t("Race profile");
  const title = t("{name} forecast — Midterm Pulse 2026", { name });
  const description = t("{name}: 2026 win probability, projected margin, polls, prediction markets, election history and Census profile.", { name });
  return { title, description, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } };
}

export default async function RaceProfilePage({ params }: PageProps<"/[lang]/races/[slug]">) {
  const { slug } = await params;
  return <main className="page-main"><div className="content-shell race-profile-shell"><RaceProfile slug={slug} /><SiteFooter /></div></main>;
}
