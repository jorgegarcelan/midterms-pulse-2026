import type { Metadata } from "next";
import Link from "@/components/i18n/link";
import { SiteFooter } from "@/components/site-footer";
import { COUNTING_NOTES, etLabel, POLL_CLOSING, spainTime } from "@/data/poll-closing";
import { stateByCode } from "@/data/geography";
import { isLocale, type Locale } from "@/i18n/config";
import { getT } from "@/i18n/translate";
import { consensus, expertBook, RATERS } from "@/lib/expert-ratings";
import type { ForecastRace } from "@/lib/forecast";
import { getModel } from "@/lib/model-server";
import { loadRacePolls, raceAverage } from "@/lib/race-polls";
import { closingTime, raceKey } from "@/lib/night";
import { NightTimeline, type TimelineSlot } from "@/components/night/night-timeline";
import { raceName, raceSlug } from "@/lib/races";

export const revalidate = 900;

const localeOf = (lang: string): Locale => (isLocale(lang) ? lang : "es");

export async function generateMetadata({ params }: PageProps<"/[lang]/election-night">): Promise<Metadata> {
  const t = getT(localeOf((await params).lang));
  return { title: t("Election night, hour by hour — Midterm Pulse 2026"), description: t("When polls close in every state on 3 November, in Spanish time, and which races to watch in each hour.") };
}

// Races to watch: every race the raters' consensus keeps at Lean or closer (Senate: Likely or closer).
function inPlay(race: ForecastRace) {
  const score = consensus(race)?.score;
  if (score === undefined) return false;
  return Math.abs(score) <= (race.chamber === "senate" ? 2 : 1.5);
}

export default async function ElectionNightPage({ params }: PageProps<"/[lang]/election-night">) {
  const lang = localeOf((await params).lang);
  const t = getT(lang);
  // The model supplies the list of races and their facts; the guide itself shows ratings and polls only.
  const [model, polls] = await Promise.all([getModel(), loadRacePolls()]);
  const today = new Date().toISOString().slice(0, 10);
  const strength = (race: ForecastRace) => Math.abs(consensus(race)?.score ?? 0);
  const watch = model.races.filter(inPlay).sort((a, b) => (a.chamber === b.chamber ? strength(a) - strength(b) : a.chamber === "senate" ? -1 : 1));

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
        const average = raceAverage(polls.get(raceKey(race)), today);
        const agreed = consensus(race);
        return {
          key: raceKey(race), href: `/races/${raceSlug(race)}`, special: race.special,
          name: race.chamber === "senate" ? t("{state} Senate", { state: stateName(race.state) }) : race.code, cook: rating ? t(rating) : null,
          rating: agreed ? { label: t(agreed.label), score: agreed.score } : null,
          polls: average ? `${average.margin >= 0 ? "D" : "R"}+${Math.abs(average.margin).toLocaleString(lang === "es" ? "es-ES" : "en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` : null, pollsLean: average ? Math.sign(average.margin) : 0,
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
        ? t("Every time is peninsular Spanish time, in the early hours of 4 November (one hour less in the Canary Islands). For each poll closing: which states close and which races to watch, with the expert rating and the polling average.")
        : t("Every time is Eastern Time on 3 November, with Spanish time alongside. For each poll closing: which states close and which races to watch, with the expert rating and the polling average.")}</p>
    </div><div className="stat-stamp"><strong>{watch.length}</strong><span>{t("races to watch")}</span><small>{t("Cook, Inside Elections, Sabato")}</small></div></section>

    <NightTimeline slots={slots} names={names} />

    <section className="panel night-footnote">
      <p className="eyebrow">{t("HOW TO READ THIS PAGE")}</p>
      <p>{t("Times are when the last polls in each state close; networks rarely project a state before then. Safe states are often called the moment polls close, close races can take hours or days. Races listed are every Senate race the raters keep at Likely or closer and every House race they keep at Lean or closer.")}</p>
      <p><Link href="/races">{t("Full race directory →")}</Link></p>
    </section>
    <SiteFooter />
  </div></main>;
}
