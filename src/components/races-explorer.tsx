"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/i18n/link";
import { useElectionContext } from "@/components/election-context";
import { states } from "@/data/geography";
import type { ForecastRace } from "@/lib/forecast";
import { raceSlug } from "@/lib/races";
import { disagreement, expertBook } from "@/lib/expert-ratings";
import { useT } from "@/components/i18n/locale-provider";

type ModelFeed = { races: ForecastRace[]; runDate: string; version: string };

function ExpertCell({ race }: { race: ForecastRace }) {
  const t = useT();
  const entry = expertBook(race);
  const split = disagreement(race);
  if (!entry) return <span className="expert-mini">—</span>;
  const ratings = [...new Set(Object.values(entry.book).filter(Boolean))];
  return <span className={`expert-mini${split ? " split" : ""}`} title={split ? t("The model is more bullish than the handicappers") : undefined}>{ratings.map((rating) => t(rating as string)).join(" · ")}{split && <i aria-label={t("Model disagrees")}>≠</i>}</span>;
}

export function RacesExplorer() {
  const t = useT();
  const context = useElectionContext();
  const [model, setModel] = useState<ModelFeed | null>(null);
  const [search, setSearch] = useState("");
  const [maxMargin, setMaxMargin] = useState("all");
  const [onlySplits, setOnlySplits] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/model", { signal: controller.signal }).then((response) => response.json() as Promise<ModelFeed>).then(setModel).catch(() => undefined);
    return () => controller.abort();
  }, []);

  const races = useMemo(() => (model?.races || []).filter((race) => {
    if (context.stateCode !== "US" && race.state !== context.stateCode) return false;
    if (context.chamber !== "all" && race.chamber !== context.chamber) return false;
    if (maxMargin !== "all" && race.margin > Number(maxMargin)) return false;
    if (onlySplits && !disagreement(race)) return false;
    return !search || `${race.code} ${race.name} ${race.rating} ${t(race.rating)}`.toLowerCase().includes(search.toLowerCase());
  }).sort((a, b) => a.margin - b.margin), [context.chamber, context.stateCode, maxMargin, model, onlySplits, search, t]);

  return <>
    <section className="page-intro"><div><p className="eyebrow">{t("HOUSE + SENATE · RACE DIRECTORY")}</p><h1>{t("Every race, one profile")}</h1><p>{t("Search the full forecast, rank contests by competitiveness and open a profile with candidates, campaign finance, model signals and geography.")}</p></div><div className="stat-stamp"><strong>{races.length}</strong><span>{t("races in view")}</span><small>{model ? `${model.version} · ${model.runDate}` : t("Loading model…")}</small></div></section>
    <section className="panel races-directory">
      <div className="race-directory-filters">
        <label>{t("Search")}<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("PA-07, Alaska, Toss Up…")} /></label>
        <label>{t("State")}<select value={context.stateCode} onChange={(event) => context.setContext({ stateCode: event.target.value })}><option value="US">{t("All states")}</option>{states.map((state) => <option key={state.code} value={state.code}>{t(state.name)}</option>)}</select></label>
        <label>{t("Chamber")}<select value={context.chamber} onChange={(event) => context.setContext({ chamber: event.target.value as "all" | "house" | "senate" })}><option value="all">{t("Both")}</option><option value="house">{t("House")}</option><option value="senate">{t("Senate")}</option></select></label>
        <label>{t("Maximum margin")}<select value={maxMargin} onChange={(event) => setMaxMargin(event.target.value)}><option value="all">{t("All ratings")}</option><option value="3">{t("{count} points", { count: 3 })}</option><option value="5">{t("{count} points", { count: 5 })}</option><option value="10">{t("{count} points", { count: 10 })}</option></select></label>
        <label>{t("Handicappers")}<select value={onlySplits ? "split" : "all"} onChange={(event) => setOnlySplits(event.target.value === "split")}><option value="all">{t("All races")}</option><option value="split">{t("Model disagrees with experts")}</option></select></label>
      </div>
      <div className="race-directory-table">
        <div className="race-directory-head"><span>{t("Race")}</span><span>{t("Model rating")}</span><span>Cook · IE · Sabato</span><span>{t("Projected vote")}</span><span>{t("Margin")}</span><span>{t("Win probability")}</span></div>
        {races.map((race) => <Link key={`${race.chamber}-${race.code}`} href={`/races/${raceSlug(race)}`}><span><strong>{race.chamber === "senate" ? t("{code} Senate", { code: race.code }) : race.code}</strong><small>{race.chamber === "house" ? t("U.S. House") : t("U.S. Senate")}</small></span><span>{t(race.rating)}</span><ExpertCell race={race} /><span className="race-vote-cell"><i className="dem" style={{ width: `${race.demVote || 50}%` }} /><i className="rep" style={{ width: `${race.repVote || 50}%` }} /></span><b className={race.leader === "D" ? "dem-text" : "rep-text"}>{race.leader}+{race.margin.toFixed(1)}</b><em>{race.winProbability}% →</em></Link>)}
        {model && races.length === 0 && <p className="table-empty">{t("No races match the selected filters.")}</p>}
      </div>
    </section>
  </>;
}
