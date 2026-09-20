"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useElectionContext } from "@/components/election-context";
import { states } from "@/data/geography";
import type { ForecastRace } from "@/lib/forecast";
import { raceSlug } from "@/lib/races";

type ModelFeed = { races: ForecastRace[]; runDate: string; version: string };

export function RacesExplorer() {
  const context = useElectionContext();
  const [model, setModel] = useState<ModelFeed | null>(null);
  const [search, setSearch] = useState("");
  const [maxMargin, setMaxMargin] = useState("all");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/model", { signal: controller.signal }).then((response) => response.json() as Promise<ModelFeed>).then(setModel).catch(() => undefined);
    return () => controller.abort();
  }, []);

  const races = useMemo(() => (model?.races || []).filter((race) => {
    if (context.stateCode !== "US" && race.state !== context.stateCode) return false;
    if (context.chamber !== "all" && race.chamber !== context.chamber) return false;
    if (maxMargin !== "all" && race.margin > Number(maxMargin)) return false;
    return !search || `${race.code} ${race.name} ${race.rating}`.toLowerCase().includes(search.toLowerCase());
  }).sort((a, b) => a.margin - b.margin), [context.chamber, context.stateCode, maxMargin, model, search]);

  return <>
    <section className="page-intro"><div><p className="eyebrow">HOUSE + SENATE · RACE DIRECTORY</p><h1>Every race, one profile</h1><p>Search the full forecast, rank contests by competitiveness and open a profile with candidates, campaign finance, model signals and geography.</p></div><div className="stat-stamp"><strong>{races.length}</strong><span>races in view</span><small>{model ? `${model.version} · ${model.runDate}` : "Loading model…"}</small></div></section>
    <section className="panel races-directory">
      <div className="race-directory-filters">
        <label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="PA-07, Alaska, Toss Up…" /></label>
        <label>State<select value={context.stateCode} onChange={(event) => context.setContext({ stateCode: event.target.value })}><option value="US">All states</option>{states.map((state) => <option key={state.code} value={state.code}>{state.name}</option>)}</select></label>
        <label>Chamber<select value={context.chamber} onChange={(event) => context.setContext({ chamber: event.target.value as "all" | "house" | "senate" })}><option value="all">Both</option><option value="house">House</option><option value="senate">Senate</option></select></label>
        <label>Maximum margin<select value={maxMargin} onChange={(event) => setMaxMargin(event.target.value)}><option value="all">All ratings</option><option value="3">3 points</option><option value="5">5 points</option><option value="10">10 points</option></select></label>
      </div>
      <div className="race-directory-table">
        <div className="race-directory-head"><span>Race</span><span>Rating</span><span>Projected vote</span><span>Margin</span><span>Win probability</span></div>
        {races.map((race) => <Link key={`${race.chamber}-${race.code}`} href={`/races/${raceSlug(race)}`}><span><strong>{race.chamber === "senate" ? `${race.code} Senate` : race.code}</strong><small>{race.chamber === "house" ? "U.S. House" : "U.S. Senate"}</small></span><span>{race.rating}</span><span className="race-vote-cell"><i className="dem" style={{ width: `${race.demVote || 50}%` }} /><i className="rep" style={{ width: `${race.repVote || 50}%` }} /></span><b className={race.leader === "D" ? "dem-text" : "rep-text"}>{race.leader}+{race.margin.toFixed(1)}</b><em>{race.winProbability}% →</em></Link>)}
        {model && races.length === 0 && <p className="table-empty">No races match the selected filters.</p>}
      </div>
    </section>
  </>;
}
