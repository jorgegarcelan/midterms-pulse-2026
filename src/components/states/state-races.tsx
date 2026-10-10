"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/i18n/link";
import { useT } from "@/components/i18n/locale-provider";
import { stateByCode } from "@/data/geography";
import { loadCandidates, type Candidate, type CandidateData } from "@/lib/candidates";
import { expertBook } from "@/lib/expert-ratings";
import type { ForecastRace } from "@/lib/forecast";
import { raceSlug } from "@/lib/races";
import { demChance, inPlay } from "@/lib/state-summary";
import "./states.css";

const signed = (value: number) => `${value >= 0 ? "D" : "R"}+${Math.abs(value).toFixed(1)}`;
const tone = (rating: string | null | undefined) => !rating ? "" : rating.endsWith(" D") ? "dem-text" : rating.endsWith(" R") ? "rep-text" : "toss-text";
const surname = (name: string) => name.replace(/\s+(Jr\.?|Sr\.?|II|III|IV)$/i, "").split(" ").at(-1) ?? name;

// The races on a state's ballot, first on its page: the Senate seat(s), then every House district.
export function StateRaces({ code, races, president2024 }: { code: string; races: ForecastRace[]; president2024: number | null }) {
  const t = useT();
  const state = code.toUpperCase();
  const name = t(stateByCode.get(state)?.name || state);
  const [candidates, setCandidates] = useState<CandidateData | null>(null);
  const [onlyInPlay, setOnlyInPlay] = useState(false);
  useEffect(() => { let alive = true; loadCandidates().then((data) => { if (alive) setCandidates(data); }).catch(() => undefined); return () => { alive = false; }; }, []);

  const senate = races.filter((race) => race.chamber === "senate");
  const house = useMemo(() => races.filter((race) => race.chamber === "house").sort((a, b) => Math.abs(demChance(a) - 50) - Math.abs(demChance(b) - 50)), [races]);
  const shownHouse = onlyInPlay ? house.filter(inPlay) : house;
  const expectedD = house.reduce((sum, race) => sum + demChance(race) / 100, 0);
  const competitive = house.filter(inPlay).length;

  const bySlug = useMemo(() => new Map((candidates?.candidates ?? []).map((candidate) => [candidate.slug, candidate])), [candidates]);
  const nominees = (race: ForecastRace): Candidate[] => (candidates?.races[`${race.chamber}:${race.code}`]?.candidates ?? []).flatMap((slug) => bySlug.get(slug) ?? []).filter((candidate) => candidate.party === "D" || candidate.party === "R" || candidate.party === "I");
  const cook = (race: ForecastRace) => expertBook(race)?.book.cook ?? null;

  return <section className="state-races" aria-labelledby="state-title">
    <nav className="race-breadcrumb" aria-label={t("Breadcrumb")}><Link href="/states">{t("States")}</Link><span>/</span><b>{name}</b></nav>
    <div className="state-hero">
      <div><p className="eyebrow">{t("STATE · 2026 MIDTERMS")}</p><h1 id="state-title">{name}</h1></div>
      <div className="state-hero-stats">
        <div><strong>{house.length}</strong><span>{house.length === 1 ? t("House seat") : t("House seats")}</span></div>
        <div><strong className="dem-text">{expectedD.toFixed(1)}</strong><span>{t("expected D seats")}</span></div>
        <div><strong>{competitive}</strong><span>{t("in play")}</span></div>
        {president2024 !== null && <div><strong className={president2024 >= 0 ? "dem-text" : "rep-text"}>{signed(president2024)}</strong><span>{t("President 2024")}</span></div>}
      </div>
    </div>

    {senate.length > 0 && <div className="state-senate">
      {senate.map((race) => {
        const p = demChance(race);
        const list = nominees(race);
        const rating = cook(race);
        return <Link key={race.code + race.special} href={`/races/${raceSlug(race)}`} className="state-senate-card">
          <div className="state-senate-head"><p className="eyebrow">{race.special ? t("SENATE · SPECIAL ELECTION") : t("SENATE")}</p><h2>{t("{state} Senate", { state: name })}</h2></div>
          <div className="state-senate-odds"><strong className={p >= 50 ? "dem-text" : "rep-text"}>{p >= 50 ? `${p}% D` : `${100 - p}% R`}</strong><span>{t("Model margin {m}", { m: signed(race.signedMargin) })}</span>{rating && <span className={tone(rating)}>Cook: {t(rating)}</span>}</div>
          <div className="state-prob" aria-hidden="true"><i className="dem" style={{ width: `${p}%` }} /><i className="rep" style={{ width: `${100 - p}%` }} /><b /></div>
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
          const p = demChance(race);
          const list = nominees(race);
          const dem = list.filter((candidate) => candidate.party === "D");
          const rep = list.filter((candidate) => candidate.party === "R");
          const rating = cook(race);
          return <Link key={race.code} href={`/races/${raceSlug(race)}`} className={`state-district${inPlay(race) ? " hot" : ""}`}>
            <header><b>{race.code.endsWith("-00") ? t("At-large") : race.code}</b>{rating && <small className={tone(rating)}>{t(rating)}</small>}</header>
            <div className="state-district-odds"><strong className={p >= 50 ? "dem-text" : "rep-text"}>{p >= 50 ? `${p}% D` : `${100 - p}% R`}</strong><span>{signed(race.signedMargin)}</span></div>
            <div className="state-prob small" aria-hidden="true"><i className="dem" style={{ width: `${p}%` }} /><i className="rep" style={{ width: `${100 - p}%` }} /><b /></div>
            {(dem.length > 0 || rep.length > 0) && <p className="state-district-names"><span className="dem-text">{dem.map((candidate) => surname(candidate.name)).join(" / ") || "—"}</span> {t("vs")} <span className="rep-text">{rep.map((candidate) => surname(candidate.name)).join(" / ") || "—"}</span></p>}
          </Link>;
        })}
        {shownHouse.length === 0 && <p className="table-empty">{t("No House race here is in play.")}</p>}
      </div>
    </div>}
  </section>;
}
