import type { Metadata } from "next";
import Link from "@/components/i18n/link";
import { SiteFooter } from "@/components/site-footer";
import { COUNTING_NOTES, etLabel, POLL_CLOSING, spainTime } from "@/data/poll-closing";
import { stateByCode } from "@/data/geography";
import { isLocale, type Locale } from "@/i18n/config";
import { getT } from "@/i18n/translate";
import { expertBook, expertScore, RATERS } from "@/lib/expert-ratings";
import type { ForecastRace } from "@/lib/forecast";
import { getModel } from "@/lib/model-server";
import { closingTime, raceKey } from "@/lib/night";
import { NightTimeline, type TimelineSlot } from "@/components/night/night-timeline";
import { raceName, raceSlug } from "@/lib/races";

export const revalidate = 900;

const localeOf = (lang: string): Locale => (isLocale(lang) ? lang : "es");

export async function generateMetadata({ params }: PageProps<"/[lang]/election-night">): Promise<Metadata> {
  const t = getT(localeOf((await params).lang));
  return { title: t("Election night, hour by hour — Midterm Pulse 2026"), description: t("When polls close in every state on 3 November, in Spanish time, and which races to watch in each hour.") };
}

const demProbability = (race: ForecastRace) => (race.leader === "D" ? race.winProbability : 100 - race.winProbability);

// Every Senate race that is not a lock, plus House races the model or the raters consider competitive.
function inPlay(race: ForecastRace) {
  const p = demProbability(race);
  if (race.chamber === "senate") return p > 10 && p < 90;
  const entry = expertBook(race);
  const experts = entry?.listed ? expertScore(entry.book) : null;
  return (p >= 25 && p <= 75) || (experts !== null && experts !== undefined && Math.abs(experts) <= 1.5);
}

export default async function ElectionNightPage({ params }: PageProps<"/[lang]/election-night">) {
  const lang = localeOf((await params).lang);
  const t = getT(lang);
  const model = await getModel();
  const watch = model.races.filter(inPlay).sort((a, b) => (a.chamber === b.chamber ? a.margin - b.margin : a.chamber === "senate" ? -1 : 1));

  const primary = (et: string) => (lang === "es" ? spainTime(et) : etLabel(et));
  const secondary = (et: string) => (lang === "es" ? etLabel(et) : `${spainTime(et)} ${t("in Spain")}`);
  const stateName = (code: string) => t(stateByCode.get(code)?.name || code);
  const cook = (race: ForecastRace) => expertBook(race)?.book[RATERS[0].key] ?? null;

  // Plain data for the live timeline: it adds the clock and the calls on the client.
  const slots: TimelineSlot[] = [...new Set(POLL_CLOSING.map((state) => state.close))].sort().map((close) => {
    const states = POLL_CLOSING.filter((state) => state.close === close);
    const codes = new Set(states.map((state) => state.code));
    return {
      close, closeAt: closingTime(close), primary: primary(close), secondary: secondary(close),
      states: states.map((state) => ({
        code: state.code, name: stateName(state.code),
        title: state.firstClose ? t("Most polls close at {time}", { time: primary(state.firstClose) }) : undefined,
        small: state.firstClose ? t("most at {time}", { time: primary(state.firstClose) }) : undefined,
      })),
      races: watch.filter((race) => codes.has(race.state)).map((race) => {
        const rating = cook(race);
        return {
          key: raceKey(race), href: `/races/${raceSlug(race)}`, special: race.special, leader: race.leader, margin: race.margin, p: demProbability(race),
          name: race.chamber === "senate" ? t("{state} Senate", { state: stateName(race.state) }) : race.code, cook: rating ? t(rating) : null,
        };
      }),
      keys: model.races.filter((race) => codes.has(race.state)).map(raceKey),
      notes: states.filter((state) => COUNTING_NOTES[state.code]).map((state) => ({ name: stateName(state.code), text: t(COUNTING_NOTES[state.code]) })),
    };
  });
  const names = Object.fromEntries(model.races.map((race) => [raceKey(race), raceName(race, t)]));

  return <main className="page-main"><div className="content-shell night-shell">
    <section className="page-intro"><div>
      <p className="eyebrow">{t("3 NOVEMBER 2026 · ELECTION NIGHT")}</p>
      <h1>{t("Election night, hour by hour")}</h1>
      <p>{lang === "es"
        ? t("Every time is peninsular Spanish time, in the early hours of 4 November (one hour less in the Canary Islands). For each poll closing: which states close and which races to watch, with the model and the Cook rating.")
        : t("Every time is Eastern Time on 3 November, with Spanish time alongside. For each poll closing: which states close and which races to watch, with the model and the Cook rating.")}</p>
    </div><div className="stat-stamp"><strong>{watch.length}</strong><span>{t("races to watch")}</span><small>{model.version} · {model.runDate}</small></div></section>

    <NightTimeline slots={slots} names={names} />

    <section className="panel night-footnote">
      <p className="eyebrow">{t("HOW TO READ THIS PAGE")}</p>
      <p>{t("Times are when the last polls in each state close; networks rarely project a state before then. Safe states are often called the moment polls close, close races can take hours or days. Races listed are every Senate race that is not a lock and every House race the model puts between 25% and 75% or the raters keep within Lean.")}</p>
      <p><Link href="/races">{t("Full race directory →")}</Link></p>
    </section>
    <SiteFooter />
  </div></main>;
}
