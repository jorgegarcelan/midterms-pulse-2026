import type { Metadata } from "next";
import directory from "../../../../public/data/candidates-2026.json";
import Link from "@/components/i18n/link";
import { RaceReadingsView } from "@/components/readings/readings";
import { SiteFooter } from "@/components/site-footer";
import { stateByCode } from "@/data/geography";
import { KEY_GOVERNOR_RACES, KEY_RACES, KEY_RACES_GUIDE } from "@/data/key-races";
import { isLocale, type Locale } from "@/i18n/config";
import { getT } from "@/i18n/translate";
import { raceKey, type Candidate, type CandidateData } from "@/lib/candidates";
import { expertBook, RATERS } from "@/lib/expert-ratings";
import type { ForecastRace } from "@/lib/forecast";
import { getModel } from "@/lib/model-server";
import { raceReadings, readingsDisagree } from "@/lib/readings";
import { governorAverage, governorPolls } from "@/lib/votehub";
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
  const model = await getModel();
  const byKey = new Map(model.races.map((race) => [raceKey(race), race]));
  const races = KEY_RACES.flatMap((key) => byKey.get(key) || []);
  const stateName = (code: string) => t(stateByCode.get(code)?.name || code);

  // Major-party nominees; where no Democrat runs (Nebraska), the independent is the non-Republican side.
  const nominees = (race: ForecastRace) => (data.races[raceKey(race)]?.candidates || [])
    .flatMap((slug) => bySlug.get(slug) || [])
    .filter((candidate) => MAJOR.includes(candidate.party))
    .filter((candidate, _, list) => candidate.party !== "I" || !list.some((other) => other.party === "D"))
    .sort((a, b) => MAJOR.indexOf(a.party) - MAJOR.indexOf(b.party));

  const today = new Date().toISOString().slice(0, 10);
  const [readings, governors] = await Promise.all([
    raceReadings(races),
    Promise.all(KEY_GOVERNOR_RACES.map((race) => governorPolls(stateByCode.get(race.state)?.name || race.state)
      .then((polls) => governorAverage(polls, race.candidates.map((candidate) => candidate.name), today)).catch(() => null))),
  ]);
  const intl = lang === "es" ? "es-ES" : "en-US";
  const day = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString(intl, { day: "numeric", month: "short", timeZone: "UTC" });
  const split = races.filter((race) => readingsDisagree(readings.get(raceKey(race))!)).length;

  const card = (race: ForecastRace) => {
    const cook = expertBook(race)?.book[RATERS[0].key] ?? null;
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
      <RaceReadingsView readings={readings.get(raceKey(race))!} />
      {cook && <p className="key-race-meta">Cook: {t(cook)}</p>}
      <Link className="key-race-link" href={`/races/${raceSlug(race)}`}>{t("Race profile →")}</Link>
    </article>;
  };

  return <main className="page-main"><div className="content-shell key-races-shell">
    <section className="page-intro"><div>
      <p className="eyebrow">{t("KEY RACES · A GUIDE BY CALLE 14")}</p>
      <h1>{t("The races that matter")}</h1>
      <p>{t("Mario Castroviejo picked, in Calle 14, the races that can decide control of Congress and several states, and explains each one: candidates, district, ads and polls. Here they are with four readings: the polling average, prediction markets, the MP-26 model (polls and fundamentals) and Census-26 (demographics only, no polls). For the candidates and the campaigns, read the guide.")}</p>
      <p className="key-races-cta">
        <a className="key-races-button" href={KEY_RACES_GUIDE.url} target="_blank" rel="noopener">{t("Read the guide in Calle 14")} ↗</a>
        <a href={KEY_RACES_GUIDE.home} target="_blank" rel="noopener">{t("Subscribe to Calle 14")} ↗</a>
      </p>
    </div><div className="stat-stamp"><strong>{split}</strong><span>{t("of {n} races where the readings disagree on who leads", { n: races.length })}</span><small>{t("Polls, markets, MP-26 and Census-26")}</small></div></section>

    <h2 className="key-races-section">{t("Senate")}</h2>
    <div className="key-races-grid">{races.filter((race) => race.chamber === "senate").map(card)}</div>

    <h2 className="key-races-section">{t("House")}</h2>
    <div className="key-races-grid">{races.filter((race) => race.chamber === "house").map(card)}</div>

    <h2 className="key-races-section">{t("Governor")}</h2>
    <p className="key-races-note">{t("The models forecast Congress only, so these two races show their polling average. The guide covers both.")}</p>
    <div className="key-races-grid">{KEY_GOVERNOR_RACES.map((race, index) => {
      const average = governors[index];
      const share = (name: string) => average?.candidates.find((row) => row.name === name)?.pct;
      return <article key={race.state} className="panel key-race">
      <header><p className="eyebrow">{t("GOVERNOR")}</p><h2>{stateName(race.state)}</h2></header>
      <ul className="key-race-nominees">{race.candidates.map((candidate) => <li key={candidate.name} className={candidate.party === "R" ? "rep" : "dem"}><b>{candidate.party}</b><span>{candidate.name}</span>{share(candidate.name) !== undefined && <strong className="key-race-share">{share(candidate.name)!.toLocaleString(intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</strong>}</li>)}</ul>
      <p className="key-race-meta">{average ? t("VoteHub polling average · {n} polls, latest {date}", { n: average.polls, date: day(average.latest) }) : t("No public polls")}</p>
      {race.note && <p className="key-race-meta">{t(race.note)}</p>}
      <a className="key-race-link" href={KEY_RACES_GUIDE.url} target="_blank" rel="noopener">{t("In the guide")} ↗</a>
    </article>; })}</div>

    <p className="key-races-source">{t("Selection: {author}, “{title}”, {outlet}. Polls: Vote-Scope poll index and, for governors, VoteHub (CC BY 4.0), averaged by Midterm Pulse. Models and candidate lists: Midterm Pulse.", { author: KEY_RACES_GUIDE.author, title: KEY_RACES_GUIDE.title, outlet: KEY_RACES_GUIDE.outlet })}</p>
    <SiteFooter />
  </div></main>;
}
