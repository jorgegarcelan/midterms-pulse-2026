import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { StreamIndex } from "@/components/stream/stream-index";
import { isLocale } from "@/i18n/config";
import { getT } from "@/i18n/translate";

export async function generateMetadata({ params }: PageProps<"/[lang]/stream">): Promise<Metadata> {
  const { lang } = await params;
  const t = getT(isLocale(lang) ? lang : "es");
  return { title: t("Stream mode — Midterm Pulse 2026"), description: t("Full-screen scenes for OBS: control scoreboard, Senate builder and race cards.") };
}

export default function StreamPage() {
  return <main className="page-main"><div className="content-shell"><StreamIndex /><SiteFooter /></div></main>;
}
