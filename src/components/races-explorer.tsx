"use client";

import "@/app/motion-b.css";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/i18n/link";
import { useElectionContext } from "@/components/election-context";
import { stateByCode, states } from "@/data/geography";
import type { ForecastRace } from "@/lib/forecast";
import { raceSlug } from "@/lib/races";
import { disagreement, expertBook } from "@/lib/expert-ratings";
import { useLocalePath, useT } from "@/components/i18n/locale-provider";
import { RaceMap } from "@/components/races/race-map";
import { ShareImageButton } from "@/components/share-image-button";
import "@/components/races/races.css";
import { CountUp } from "@/components/motion/count-up";
import { useFlipList } from "@/components/motion/race-tween";

type ModelFeed = { races: ForecastRace[]; runDate: string; version: string };
type View = "map" | "list";

function ExpertCell({ race }: { race: ForecastRace }) {
  const t = useT();
  const entry = expertBook(race);
  const split = disagreement(race);
  if (!entry) return <span className="expert-mini">—</span>;
  const ratings = [...new Set(Object.values(entry.book).filter(Boolean))];
  return <span className={`expert-mini${split ? " split" : ""}`} title={split ? t("The model is more bullish than the handicappers") : undefined}>{ratings.map((rating) => t(rating as string)).join(" · ")}{split && <i aria-label={t("Model disagrees")}>≠</i>}</span>;
}

/*
  Every race in one place, as a map or a list with the same filters. The map shows House districts or
  Senate states; the list ranks every race by margin. The view and filters live in the URL.
*/
export function RacesExplorer() {
  const t = useT();
  const router = useRouter();
  const localize = useLocalePath();
  const context = useElectionContext();
  const [model, setModel] = useState<ModelFeed | null>(null);
  const [search, setSearch] = useState("");
  const [maxMargin, setMaxMargin] = useState("all");
  const [onlySplits, setOnlySplits] = useState(false);
  const [view, setView] = useState<View>("map");
  const [mapChamber, setMapChamber] = useState<"house" | "senate">("house");
  const [hovered, setHovered] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/model", { signal: controller.signal }).then((response) => response.json() as Promise<ModelFeed>).then(setModel).catch(() => undefined);
    // Old /districts links and shared URLs carry ?view=map|list.
    const requested = new URLSearchParams(window.location.search).get("view");
    const timer = window.setTimeout(() => { if (requested === "list" || requested === "map") setView(requested); }, 0);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, []);

  function chooseView(next: View) {
    setView(next);
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    window.history.replaceState({}, "", url);
  }

  // The map follows the chamber filter; with both chambers selected it has its own House/Senate switch.
  const shownChamber = context.chamber === "all" ? mapChamber : context.chamber;

  const races = useMemo(() => (model?.races || []).filter((race) => {
    if (context.stateCode !== "US" && race.state !== context.stateCode && !(view === "map" && shownChamber === "senate")) return false;
    if (context.chamber !== "all" && race.chamber !== context.chamber) return false;
    if (maxMargin !== "all" && race.margin > Number(maxMargin)) return false;
    if (onlySplits && !disagreement(race)) return false;
    return !search || `${race.code} ${race.name} ${race.rating} ${t(race.rating)} ${t(stateByCode.get(race.state)?.name || "")}`.toLowerCase().includes(search.toLowerCase());
  }).sort((a, b) => a.margin - b.margin), [context.chamber, context.stateCode, maxMargin, model, onlySplits, search, shownChamber, t, view]);
  const tableRef = useFlipList<HTMLDivElement>(view === "list" ? races.map((race) => `${race.chamber}-${race.code}`).join() : "");

  const mapRaces = races.filter((race) => race.chamber === shownChamber);
  const filtering = Boolean(search) || maxMargin !== "all" || onlySplits;
  const matches = useMemo(() => filtering ? new Set(mapRaces.map((race) => race.code)) : null, [filtering, mapRaces]);
  const raceLabel = (race: ForecastRace) => race.chamber === "senate" ? t("{state} Senate", { state: t(stateByCode.get(race.state)?.name || race.state) }) : race.code;
  const openRace = (race: ForecastRace) => router.push(localize(`/races/${raceSlug(race)}`));

  return <>
    <section className="page-intro"><div><p className="eyebrow">{t("HOUSE + SENATE · 470 RACES")}</p><h1>{t("Every race, on the map and in the list")}</h1><p>{t("Explore the map or search the list: both share the same filters. Open any race for its candidates, money, polls and history.")}</p></div><div className="stat-stamp"><strong><CountUp value={view === "map" ? mapRaces.length : races.length} /></strong><span>{t("races in view")}</span><small>{model ? `${model.version} · ${model.runDate}` : t("Loading model…")}</small></div></section>

    <section className="races-toolbar">
      <div className="races-view-switch" role="tablist" aria-label={t("View")}>
        <button type="button" role="tab" aria-selected={view === "map"} className={view === "map" ? "active" : ""} onClick={() => chooseView("map")}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 5l5-2 6 2 5-2v12l-5 2-6-2-5 2z M7 3v12 M13 5v12" /></svg>{t("Map")}</button>
        <button type="button" role="tab" aria-selected={view === "list"} className={view === "list" ? "active" : ""} onClick={() => chooseView("list")}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14 M3 10h14 M3 15h14" /></svg>{t("List")}</button>
      </div>
      <div className="race-directory-filters">
        <label>{t("Search")}<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("PA-07, Alaska, Toss Up…")} /></label>
        <label>{t("State")}<select value={context.stateCode} onChange={(event) => context.setContext({ stateCode: event.target.value })}><option value="US">{t("All states")}</option>{states.map((state) => <option key={state.code} value={state.code}>{t(state.name)}</option>)}</select></label>
        <label>{t("Chamber")}<select value={context.chamber} onChange={(event) => context.setContext({ chamber: event.target.value as "all" | "house" | "senate" })}><option value="all">{t("Both")}</option><option value="house">{t("House")}</option><option value="senate">{t("Senate")}</option></select></label>
        <label>{t("Maximum margin")}<select value={maxMargin} onChange={(event) => setMaxMargin(event.target.value)}><option value="all">{t("All ratings")}</option><option value="3">{t("{count} points", { count: 3 })}</option><option value="5">{t("{count} points", { count: 5 })}</option><option value="10">{t("{count} points", { count: 10 })}</option></select></label>
        <label>{t("Handicappers")}<select value={onlySplits ? "split" : "all"} onChange={(event) => setOnlySplits(event.target.value === "split")}><option value="all">{t("All races")}</option><option value="split">{t("Model disagrees with experts")}</option></select></label>
      </div>
    </section>

    {view === "map" ? <section className="district-layout races-map-layout">
      <article className="panel district-map-panel">
        <div className="panel-head races-map-head">
          <div className="segmented" role="group" aria-label={t("Chamber")}>{(["house", "senate"] as const).map((chamber) => <button key={chamber} type="button" disabled={context.chamber !== "all" && context.chamber !== chamber} className={shownChamber === chamber ? "selected" : ""} aria-pressed={shownChamber === chamber} onClick={() => setMapChamber(chamber)}>{chamber === "house" ? t("House · 435 districts") : t("Senate · 35 races")}</button>)}</div>
          <div className="district-legend"><span><i className="dem" /> {t("Democratic lead")}</span><span><i className="rep" /> {t("Republican lead")}</span>{shownChamber === "senate" && <span><i className="neutral" /> {t("No race in 2026")}</span>}</div>
        </div>
        {model ? <RaceMap chamber={shownChamber} races={model.races} matches={matches} stateCode={context.stateCode} hovered={hovered} onHover={setHovered}
          onState={(code) => { if (shownChamber === "senate" && code !== "US") router.push(localize(`/states/${code.toLowerCase()}`)); else context.setContext({ stateCode: code }); }}
          onOpen={openRace} /> : <div className="map-loading">{t("Loading Census boundaries and model output…")}</div>}
        <div className="races-map-foot"><p className="chart-note">{shownChamber === "house" ? t("Click a district to zoom into its state; click again to open the race.") : t("Click a state to open its Senate race.")}</p><ShareImageButton label={context.stateCode === "US" ? t("Download map") : t("Download {state} image", { state: context.stateCode })} href={context.stateCode === "US" ? "/api/share/map" : `/api/share/state/${context.stateCode.toLowerCase()}`} /></div>
      </article>
      <aside className="panel district-rankings">
        <div className="panel-head"><div><p className="eyebrow">{t("COMPETITIVENESS")}</p><h2>{t("Closest in view")}</h2></div><span className="panel-tag">{t("sorted by margin")}</span></div>
        <div className="district-race-list">
          {mapRaces.slice(0, 30).map((race) => <Link key={`${race.chamber}-${race.code}`} className={hovered === race.code ? "linked" : undefined} href={`/races/${raceSlug(race)}`} onMouseEnter={() => setHovered(race.code)} onMouseLeave={() => setHovered("")}><span><strong>{raceLabel(race)}</strong><small>{t(race.rating)}</small></span><b className={race.leader === "D" ? "dem-text" : "rep-text"}>{race.leader}+{race.margin.toFixed(1)}</b><em>{race.winProbability}%</em></Link>)}
          {model && mapRaces.length === 0 && <p className="table-empty">{t("No races match the selected filters.")}</p>}
        </div>
        {mapRaces.length > 30 && <button type="button" className="text-button" onClick={() => chooseView("list")}>{t("See all {count} races →", { count: mapRaces.length })}</button>}
      </aside>
    </section> : <section className="panel races-directory">
      <div className="race-directory-table mpb-directory" ref={tableRef}>
        <div className="race-directory-head"><span>{t("Race")}</span><span>{t("Model rating")}</span><span>Cook · IE · Sabato</span><span>{t("Projected vote")}</span><span>{t("Margin")}</span><span>{t("Win probability")}</span></div>
        {races.map((race) => <Link key={`${race.chamber}-${race.code}`} data-flip={`${race.chamber}-${race.code}`} href={`/races/${raceSlug(race)}`}><span><strong>{race.chamber === "senate" ? t("{code} Senate", { code: race.code }) : race.code}</strong><small>{race.chamber === "house" ? t("U.S. House") : t("U.S. Senate")}</small></span><span>{t(race.rating)}</span><ExpertCell race={race} /><span className="race-vote-cell" title={race.demVote && race.repVote ? `D ${race.demVote.toFixed(1)}% · R ${race.repVote.toFixed(1)}%` : undefined}><i className="dem" style={{ width: `${race.demVote || 50}%` }} /><i className="rep" style={{ width: `${race.repVote || 50}%` }} /></span><b className={race.leader === "D" ? "dem-text" : "rep-text"}>{race.leader}+{race.margin.toFixed(1)}</b><em><span className="mpb-prob" style={{ "--p": race.winProbability / 100 } as React.CSSProperties} aria-hidden="true" />{race.winProbability}% <i className="mpb-arrow" aria-hidden="true">→</i></em></Link>)}
        {model && races.length === 0 && <p className="table-empty">{t("No races match the selected filters.")}</p>}
      </div>
    </section>}
  </>;
}
