import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InteractiveWorkspace } from "@/components/interactive-workspace";
import { SiteFooter } from "@/components/site-footer";
import { StateProfile } from "@/components/state/state-profile";
import { StateRaces } from "@/components/states/state-races";
import { getModel } from "@/lib/model-server";
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

// Races first (Senate, then every district), then the state's profile, then the analysis workspace.
export default async function StatePage({ params }: PageProps<"/[lang]/states/[code]">) {
  const { lang, code } = await params;
  const t = getT(isLocale(lang) ? lang : "es");
  const state = code.toUpperCase();
  if (!stateByCode.has(state)) notFound();
  const [model, president] = await Promise.all([
    getModel(),
    readFile(path.join(process.cwd(), "public/data/history/president.json"), "utf8").then((text) => (JSON.parse(text) as { states: Record<string, { y: number; m: number }[]> }).states),
  ]);
  const races = model.races.filter((race) => race.state === state);
  const president2024 = president[state]?.find((result) => result.y === 2024)?.m ?? null;
  return <main className="page-main"><div className="content-shell workspace-shell">
    <StateRaces code={state} races={races} president2024={president2024} />
    <StateProfile code={code} />
    <section className="state-advanced">
      <header><p className="eyebrow">{t("ADVANCED ANALYSIS")}</p><h2>{t("Workspace")}</h2><p>{t("Compare {state} with other states, test scenarios and follow its signals over time.", { state: t(stateByCode.get(state)?.name || state) })}</p></header>
      <InteractiveWorkspace initialStateCode={code} />
    </section>
    <SiteFooter />
  </div></main>;
}
