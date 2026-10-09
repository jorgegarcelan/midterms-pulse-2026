import type { Metadata } from "next";
import { Playground } from "@/components/playground/playground";
import { SiteFooter } from "@/components/site-footer";
import { isLocale, type Locale } from "@/i18n/config";
import { getT } from "@/i18n/translate";
import { getModel } from "@/lib/model-server";
import { TOOLS, type PlayRace, type Published, type ToolKey } from "@/lib/playground/types";
import "./playground.css";

const localeOf = (lang: string): Locale => (isLocale(lang) ? lang : "es");

export async function generateMetadata({ params }: PageProps<"/[lang]/playground">): Promise<Metadata> {
  const t = getT(localeOf((await params).lang));
  return {
    title: t("Playground — Midterm Pulse 2026"),
    description: t("Simulate scenarios, build your own House and Senate maps and explore county and district data for the 2026 U.S. midterms."),
  };
}

export default async function PlaygroundPage({ params, searchParams }: PageProps<"/[lang]/playground">) {
  const lang = localeOf((await params).lang);
  const t = getT(lang);
  const query = await searchParams;
  const initial = Object.fromEntries(Object.entries(query).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  const tool: ToolKey = TOOLS.includes(initial.tool as ToolKey) ? initial.tool as ToolKey : "scenario";
  const model = await getModel();

  const races: PlayRace[] = model.races.map((race) => ({
    chamber: race.chamber, code: race.code, state: race.state, signedMargin: race.signedMargin, leader: race.leader, margin: race.margin,
    winProbability: race.winProbability, rating: race.rating, incumbentParty: race.incumbentParty, special: race.special,
    baselineMargin: race.baselineDem !== null && race.baselineRep !== null && race.baselineDem > 0 && race.baselineRep > 0 ? Math.round((race.baselineDem - race.baselineRep) * 100) / 100 : null,
  }));
  const published: Published = {
    runDate: model.runDate, version: model.version,
    house: { demMajority: model.house.demMajority, demSeats: model.house.demSeats, interval80: model.house.interval80 },
    senate: { demMajority: model.senate.demMajority, demSeats: model.senate.demSeats, interval80: model.senate.interval80 },
  };

  return <main className="page-main"><div className="content-shell playground-shell">
    <section className="page-intro playground-intro">
      <div>
        <p className="eyebrow">{t("PLAYGROUND · {version}", { version: model.version })}</p>
        <h1>{t("Playground")}</h1>
        <p>{t("Three tools to test the forecast live: move the national environment and watch both chambers react, paint your own map, or cross any two variables across every county and district.")}</p>
      </div>
    </section>
    <Playground races={races} published={published} initialTool={tool} initial={initial} />
    <SiteFooter />
  </div></main>;
}
