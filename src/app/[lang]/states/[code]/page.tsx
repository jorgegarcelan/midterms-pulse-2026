import type { Metadata } from "next";
import { InteractiveWorkspace } from "@/components/interactive-workspace";
import { SiteFooter } from "@/components/site-footer";
import { StateProfile } from "@/components/state/state-profile";
import { stateByCode } from "@/data/geography";
import { isLocale } from "@/i18n/config";
import { getT } from "@/i18n/translate";

export async function generateMetadata({ params }: PageProps<"/[lang]/states/[code]">): Promise<Metadata> {
  const { lang, code } = await params;
  const t = getT(isLocale(lang) ? lang : "es");
  const name = t(stateByCode.get(code.toUpperCase())?.name || "State");
  const title = t("{state} 2026 midterms — Midterm Pulse 2026", { state: name });
  const description = t("{state}: House and Senate forecasts, closest districts, Census profile and presidential history.", { state: name });
  return { title, description, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } };
}

export default async function StatePage({ params }: PageProps<"/[lang]/states/[code]">) {
  const { code } = await params;
  return <main className="page-main"><div className="content-shell workspace-shell"><InteractiveWorkspace initialStateCode={code} /><StateProfile code={code} /><SiteFooter /></div></main>;
}
