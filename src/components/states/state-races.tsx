"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/i18n/link";
import { useT } from "@/components/i18n/locale-provider";
import { stateByCode } from "@/data/geography";
import { loadCandidates, type Candidate, type CandidateData } from "@/lib/candidates";
import type { RaceOverview } from "@/lib/overview-shared";
import { favours, inPlay, raceHref } from "@/lib/state-summary";
import "./states.css";

const signed = (value: number) => `${value >= 0 ? "D" : "R"}+${Math.abs(value).toFixed(1)}`;
const tone = (race: RaceOverview) => ({ D: "dem-text", R: "rep-text", toss: "toss-text" })[favours(race)];
const closeness = (race: RaceOverview) => Math.abs(race.rating?.score ?? 0) * 10 + Math.abs(race.polls?.margin ?? 10);
const surname = (name: string) => name.replace(/\s+(Jr\.?|Sr\.?|II|III|IV)$/i, "").split(" ").at(-1) ?? name;

// The races on a state's ballot, first on its page: the Senate seat(s), then every House district, each with
// the raters' consensus, the polling average and (Senate) the market. The models are in each race's profile.
export function StateRaces({ code, races, president2024 }: { code: string; races: RaceOverview[]; president2024: number | null }) {
  const t = useT();
  const state = code.toUpperCase();
  const name = t(stateByCode.get(state)?.name || state);
  const [candidates, setCandidates] = useState<CandidateData | null>(null);
  const [onlyInPlay, setOnlyInPlay] = useState(false);
  useEffect(() => { let alive = true; loadCandidates().then((data) => { if (alive) setCandidates(data); }).catch(() => undefined); return () => { alive = false; }; }, []);

  const senate = races.filter((race) => race.chamber === "senate");
  const house = useMemo(() => races.filter((race) => race.chamber === "house").sort((a, b) => closeness(a) - closeness(b)), [races]);
  const shownHouse = onlyInPlay ? house.filter(inPlay) : house;
  const favD = house.filter((race) => favours(race) === "D").length;
  const toss = house.filter((race) => favours(race) === "toss").length;
  const competitive = house.filter(inPlay).length;
  const lean = (race: RaceOverview, margin: number) => `${margin >= 0 ? race.side : "R"}+${Math.abs(margin).toFixed(1)}`;
  const odds = (race: RaceOverview, p: number) => `${Math.round((p >= .5 ? p : 1 - p) * 100)}% ${p >= .5 ? race.side : "R"}`;

  const bySlug = useMemo(() => new Map((candidates?.candidates ?? []).map((candidate) => [candidate.slug, candidate])), [candidates]);
  const nominees = (race: RaceOverview): Candidate[] => (candidates?.races[`${race.chamber}:${race.code}`]?.candidates ?? []).flatMap((slug) => bySlug.get(slug) ?? []).filter((candidate) => candidate.party === "D" || candidate.party === "R" || candidate.party === "I");

  return <section className="state-races" aria-labelledby="state-title">
    <nav className="race-breadcrumb" aria-label={t("Breadcrumb")}><Link href="/states">{t("States")}</Link><span>/</span><b>{name}</b></nav>
    <div className="state-hero">
      <div><p className="eyebrow">{t("STATE · 2026 MIDTERMS")}</p><h1 id="state-title">{name}</h1></div>
      <div className="state-hero-stats">
        <div><strong>{house.length}</strong><span>{house.length === 1 ? t("House seat") : t("House seats")}</span></div>
        <div><strong className="dem-text">{favD}</strong><span>{t("favour D")}</span></div>
        <div><strong className="toss-text">{toss}</strong><span>{t("toss-up")}</span></div>
        <div><strong>{competitive}</strong><span>{t("in play")}</span></div>
        {president2024 !== null && <div><strong className={president2024 >= 0 ? "dem-text" : "rep-text"}>{signed(president2024)}</strong><span>{t("President 2024")}</span></div>}
      </div>
    </div>

    {senate.length > 0 && <div className="state-senate">
      {senate.map((race) => {
        const list = nominees(race);
        return <Link key={race.key} href={raceHref(race)} className="state-senate-card">
          <div className="state-senate-head"><p className="eyebrow">{race.special ? t("SENATE · SPECIAL ELECTION") : t("SENATE")}</p><h2>{t("{state} Senate", { state: name })}</h2></div>
          <div className="state-senate-odds"><strong className={tone(race)}>{t(race.rating?.label || "Unrated")}</strong><span>{race.polls ? t("Polls {lean} · {n} polls", { lean: lean(race, race.polls.margin), n: race.polls.polls }) : t("No public polls")}</span>{race.market !== null && <span>Polymarket {odds(race, race.market)}</span>}</div>
          {list.length > 0 && <div className="state-nominees">{list.map((candidate) => <span key={candidate.slug} className={candidate.party === "D" ? "dem" : candidate.party === "R" ? "rep" : "ind"}><i>{candidate.party}</i>{candidate.name}{candidate.incumbent && <small>{t("incumbent")}</small>}</span>)}</div>}
          <em>{t("Open race →")}</em>
        </Link>;
      })}
    </div>}

    {house.length > 0 && <div className="state-house">
      <div className="panel-head"><div><p className="eyebrow">{t("HOUSE")}</p><h2>{house.length === 1 ? t("The district") : t("{n} districts, closest first", { n: house.length })}</h2></div>
        {house.length > 1 && <div className="segmented" role="group" aria-label={t("Filter")}><button type="button" className={!onlyInPlay ? "selected" : ""} aria-pressed={!onlyInPlay} onClick={() => setOnlyInPlay(false)}>{t("All")}</button><button type="button" className={onlyInPlay ? "selected" : ""} aria-pressed={onlyInPlay} onClick={() => setOnlyInPlay(true)}>{t("In play ({n})", { n: competitive })}</button></div>}
      </div>
      <div className="state-district-grid">
        {shownHouse.map((race) => {
          const list = nominees(race);
          const dem = list.filter((candidate) => candidate.party === "D");
          const rep = list.filter((candidate) => candidate.party === "R");
          return <Link key={race.code} href={raceHref(race)} className={`state-district${inPlay(race) ? " hot" : ""}`}>
            <header><b>{race.code.endsWith("-00") ? t("At-large") : race.code}</b></header>
            <div className="state-district-odds"><strong className={tone(race)}>{t(race.rating?.label || "Unrated")}</strong><span>{race.polls ? t("polls {lean}", { lean: lean(race, race.polls.margin) }) : t("no polls")}</span></div>
            {(dem.length > 0 || rep.length > 0) && <p className="state-district-names"><span className="dem-text">{dem.map((candidate) => surname(candidate.name)).join(" / ") || "—"}</span> {t("vs")} <span className="rep-text">{rep.map((candidate) => surname(candidate.name)).join(" / ") || "—"}</span></p>}
          </Link>;
        })}
        {shownHouse.length === 0 && <p className="table-empty">{t("No House race here is in play.")}</p>}
      </div>
    </div>}
  </section>;
}
