import type { Metadata } from "next";
import directory from "../../../../public/data/candidates-2026.json";
import Link from "@/components/i18n/link";
import { SiteFooter } from "@/components/site-footer";
import { stateByCode } from "@/data/geography";
import { KEY_GOVERNOR_RACES, KEY_RACES, KEY_RACES_GUIDE } from "@/data/key-races";
import { isLocale, type Locale } from "@/i18n/config";
import { getT } from "@/i18n/translate";
import { raceKey, type Candidate, type CandidateData } from "@/lib/candidates";
import { expertBook, RATERS } from "@/lib/expert-ratings";
import type { ForecastRace } from "@/lib/forecast";
import { loadCensusModel } from "@/lib/census-model";
import { getModel } from "@/lib/model-server";
import { loadRacePolls, raceAverage } from "@/lib/race-polls";
import { raceName, raceSlug } from "@/lib/races";
import "../../key-races.css";

export const revalidate = 900;

const localeOf = (lang: string): Locale => (isLocale(lang) ? lang : "es");
const data = directory as unknown as CandidateData;
const bySlug = new Map(data.candidates.map((candidate) => [candidate.slug, candidate]));
const MAJOR = ["D", "I", "R"];

export async function generateMetadata({ params }: PageProps<"/[lang]/key-races">): Promise<Metadata> {
  const t = getT(localeOf((await params).lang));
  const title = t("Key races — Midterm Pulse 2026");
  const description = t("The races Calle 14's guide picks as decisive for control of Congress, with Midterm Pulse's forecast for each.");
  return { title, description, openGraph: { title, description }, alternates: { languages: { es: "/key-races", en: "/en/key-races" } } };
}

export default async function KeyRacesPage({ params }: PageProps<"/[lang]/key-races">) {
  const lang = localeOf((await params).lang);
  const t = getT(lang);
  const [model, polls] = await Promise.all([getModel(), loadRacePolls()]);
  const census = new Map(loadCensusModel().races.map((race) => [`house:${race.code}`, race]));
  const intl = lang === "es" ? "es-ES" : "en-US";
  const today = new Date().toISOString().slice(0, 10);
  const one = (value: number) => value.toLocaleString(intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const day = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString(intl, { day: "numeric", month: "short", timeZone: "UTC" });
  const byKey = new Map(model.races.map((race) => [raceKey(race), race]));
  const races = KEY_RACES.flatMap((key) => byKey.get(key) || []);
  const stateName = (code: string) => t(stateByCode.get(code)?.name || code);

  // Major-party nominees; where no Democrat runs (Nebraska), the independent is the non-Republican side.
  const nominees = (race: ForecastRace) => (data.races[raceKey(race)]?.candidates || [])
    .flatMap((slug) => bySlug.get(slug) || [])
    .filter((candidate) => MAJOR.includes(candidate.party))
    .filter((candidate, _, list) => candidate.party !== "I" || !list.some((other) => other.party === "D"))
    .sort((a, b) => MAJOR.indexOf(a.party) - MAJOR.indexOf(b.party));
  const challenger = (race: ForecastRace) => nominees(race).some((candidate) => candidate.party === "D") ? "D" : "I";

  // Polls first, then the two models: each as a D-minus-R margin (D stands for the independent in Nebraska).
  const readings = (race: ForecastRace) => {
    const key = raceKey(race);
    const average = raceAverage(polls.get(key), today);
    const blind = census.get(key);
    return { average, mp26: race.signedMargin, census: blind ? { margin: blind.margin, p: blind.pD } : null };
  };
  const disagree = (race: ForecastRace) => {
    const { average, mp26, census: blind } = readings(race);
    const signs = [average?.margin, mp26, blind?.margin].filter((value): value is number => value !== undefined && Math.abs(value) >= .05).map(Math.sign);
    return new Set(signs).size > 1;
  };
  const split = races.filter(disagree).length;

  const card = (race: ForecastRace) => {
    const side = challenger(race);
    const cook = expertBook(race)?.book[RATERS[0].key] ?? null;
    const leaderLabel = race.leader === "D" ? side : "R";
    const { average, mp26, census: blind } = readings(race);
    const split = disagree(race);
    const tone = (margin: number) => (Math.abs(margin) < .05 ? "" : margin > 0 ? side === "I" ? "ind-text" : "dem-text" : "rep-text");
    const lead = (margin: number) => (Math.abs(margin) < .05 ? t("Tied") : `${margin > 0 ? side : "R"}+${one(Math.abs(margin))}`);
    return <article key={raceKey(race)} className="panel key-race">
      <header>
        <p className="eyebrow">{race.chamber === "senate" ? t("SENATE") : t("HOUSE")}{race.special ? ` · ${t("special")}` : ""}</p>
        <h2><Link href={`/races/${raceSlug(race)}`}>{race.chamber === "senate" ? stateName(race.state) : raceName(race, t)}</Link></h2>
      </header>
      <ul className="key-race-nominees">
        {nominees(race).map((candidate: Candidate) => <li key={candidate.slug} className={candidate.party === "R" ? "rep" : candidate.party === "D" ? "dem" : "ind"}>
          <b>{candidate.party}</b><Link href={`/candidates/${candidate.slug}`}>{candidate.name}</Link>{candidate.incumbent && <small>{t("incumbent")}</small>}
        </li>)}
      </ul>
      <dl className="key-race-compare">
        <div>
          <dt>{t("Polls")}</dt>
          <dd>{average ? <><strong className={tone(average.margin)}>{lead(average.margin)}</strong><small>{side} {one(average.dem)} · R {one(average.rep)} · {t("{n} polls, latest {date}", { n: average.polls, date: day(average.latest) })}</small></> : <small>{t("No public polls")}</small>}</dd>
        </div>
        <div>
          <dt>MP-26</dt>
          <dd><strong className={tone(mp26)}>{lead(mp26)}</strong><small>{t("{p}% chance for {party}", { p: race.winProbability, party: leaderLabel })}</small></dd>
        </div>
        <div>
          <dt>Census-26</dt>
          <dd>{blind ? <><strong className={tone(blind.margin)}>{lead(blind.margin)}</strong><small>{t("{p}% chance for {party}", { p: Math.round((blind.margin >= 0 ? blind.p : 1 - blind.p) * 100), party: blind.margin >= 0 ? side : "R" })}</small></> : <small>{t("House only")}</small>}</dd>
        </div>
      </dl>
      <p className="key-race-meta">{split ? <b className="key-race-split">{t("They disagree on who leads")}</b> : null}{split ? " · " : ""}{cook ? `Cook: ${t(cook)}` : ""}</p>
      <Link className="key-race-link" href={`/races/${raceSlug(race)}`}>{t("Race profile →")}</Link>
    </article>;
  };

  return <main className="page-main"><div className="content-shell key-races-shell">
    <section className="page-intro"><div>
      <p className="eyebrow">{t("KEY RACES · A GUIDE BY CALLE 14")}</p>
      <h1>{t("The races that matter")}</h1>
      <p>{t("Mario Castroviejo picked, in Calle 14, the races that can decide control of Congress and several states, and explains each one: candidates, district, ads and polls. Here they are with three readings: the polling average, the MP-26 model (polls and fundamentals) and Census-26 (demographics only, no polls). For the candidates and the campaigns, read the guide.")}</p>
      <p className="key-races-cta">
        <a className="key-races-button" href={KEY_RACES_GUIDE.url} target="_blank" rel="noopener">{t("Read the guide in Calle 14")} ↗</a>
        <a href={KEY_RACES_GUIDE.home} target="_blank" rel="noopener">{t("Subscribe to Calle 14")} ↗</a>
      </p>
    </div><div className="stat-stamp"><strong>{split}</strong><span>{t("of {n} races where the polls and the models disagree on who leads", { n: races.length })}</span><small>{t("Polls, MP-26 and Census-26")}</small></div></section>

    <h2 className="key-races-section">{t("Senate")}</h2>
    <div className="key-races-grid">{races.filter((race) => race.chamber === "senate").map(card)}</div>

    <h2 className="key-races-section">{t("House")}</h2>
    <div className="key-races-grid">{races.filter((race) => race.chamber === "house").map(card)}</div>

    <h2 className="key-races-section">{t("Governor")}</h2>
    <p className="key-races-note">{t("The model forecasts Congress only, so these two races have no forecast here. The guide covers both.")}</p>
    <div className="key-races-grid">{KEY_GOVERNOR_RACES.map((race) => <article key={race.state} className="panel key-race">
      <header><p className="eyebrow">{t("GOVERNOR")}</p><h2>{stateName(race.state)}</h2></header>
      <ul className="key-race-nominees">{race.candidates.map((candidate) => <li key={candidate.name} className={candidate.party === "R" ? "rep" : "dem"}><b>{candidate.party}</b><span>{candidate.name}</span></li>)}</ul>
      {race.note && <p className="key-race-meta">{t(race.note)}</p>}
      <a className="key-race-link" href={KEY_RACES_GUIDE.url} target="_blank" rel="noopener">{t("In the guide")} ↗</a>
    </article>)}</div>

    <p className="key-races-source">{t("Selection: {author}, “{title}”, {outlet}. Polls: Vote-Scope poll index, averaged by Midterm Pulse. Models, ratings and candidate lists: Midterm Pulse.", { author: KEY_RACES_GUIDE.author, title: KEY_RACES_GUIDE.title, outlet: KEY_RACES_GUIDE.outlet })}</p>
    <SiteFooter />
  </div></main>;
}
