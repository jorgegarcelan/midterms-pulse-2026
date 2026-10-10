import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { StatesDirectory } from "@/components/states/states-directory";
import { isLocale } from "@/i18n/config";
import { getT } from "@/i18n/translate";
import { getModel } from "@/lib/model-server";
import { summarizeStates } from "@/lib/state-summary";

export const revalidate = 900;

export async function generateMetadata({ params }: PageProps<"/[lang]/states">): Promise<Metadata> {
  const { lang } = await params;
  const t = getT(isLocale(lang) ? lang : "es");
  return { title: t("States — Midterm Pulse 2026"), description: t("All 50 states: Senate races, every House district and how each state votes.") };
}

export default async function StatesPage() {
  const [model, president] = await Promise.all([
    getModel(),
    readFile(path.join(process.cwd(), "public/data/history/president.json"), "utf8").then((text) => (JSON.parse(text) as { states: Record<string, { y: number; m: number }[]> }).states),
  ]);
  return <main className="page-main"><div className="content-shell"><StatesDirectory states={summarizeStates(model.races, president)} /><SiteFooter /></div></main>;
}
