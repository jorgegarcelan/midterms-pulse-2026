"use client";

import "@/app/motion-b.css";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/i18n/link";
import { useElectionContext } from "@/components/election-context";
import { stateByCode, states } from "@/data/geography";
import { expertBook } from "@/lib/expert-ratings";
import type { Overview, RaceOverview } from "@/lib/overview-shared";
import { useIntlLocale, useLocalePath, useT } from "@/components/i18n/locale-provider";
import { RaceMap } from "@/components/races/race-map";
import "@/components/races/races.css";
import { CountUp } from "@/components/motion/count-up";
import { useFlipList } from "@/components/motion/race-tween";

type View = "map" | "list";
type RatingFilter = "all" | "competitive" | "toss";

const RATING_FILTERS: Record<RatingFilter, (score: number) => boolean> = {
  all: () => true,
  competitive: (score) => Math.abs(score) < 1.5,
  toss: (score) => Math.abs(score) < .25,
};
// Most contested first: the rating, then how close the polls are.
const closeness = (race: RaceOverview) => Math.abs(race.rating?.score ?? 0) * 10 + Math.abs(race.polls?.margin ?? 10);
const tone = (score: number) => (score >= .25 ? "dem-text" : score <= -.25 ? "rep-text" : "toss-text");

function ExpertCell({ race }: { race: RaceOverview }) {
  const t = useT();
  const entry = expertBook({ chamber: race.chamber, code: race.code, baselineMargin: race.baseline });
  if (!entry) return <span className="expert-mini">—</span>;
  const ratings = [...new Set(Object.values(entry.book).filter(Boolean))];
  return <span className="expert-mini">{ratings.map((rating) => t(rating as string)).join(" · ")}</span>;
}

/*
  Every race in one place, as a map or a list with the same filters: what the expert raters, the polls
  and the markets say. The models are in their own sections. The view and filters live in the URL.
*/
export function RacesExplorer() {
  const t = useT();
  const intl = useIntlLocale();
  const router = useRouter();
  const localize = useLocalePath();
  const context = useElectionContext();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [search, setSearch] = useState("");
  const [rating, setRating] = useState<RatingFilter>("all");
  const [view, setView] = useState<View>("map");
  const [mapChamber, setMapChamber] = useState<"house" | "senate">("house");
  const [hovered, setHovered] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/overview", { signal: controller.signal }).then((response) => response.json() as Promise<Overview>).then(setOverview).catch(() => undefined);
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
  const one = (value: number) => value.toLocaleString(intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const lean = (race: RaceOverview, margin: number) => `${margin >= 0 ? race.side : "R"}+${one(Math.abs(margin))}`;

  const races = useMemo(() => (overview?.races || []).filter((race) => {
    if (context.stateCode !== "US" && race.state !== context.stateCode && !(view === "map" && shownChamber === "senate")) return false;
    if (context.chamber !== "all" && race.chamber !== context.chamber) return false;
    if (!RATING_FILTERS[rating](race.rating?.score ?? 0)) return false;
    const label = race.rating?.label || "";
    return !search || `${race.code} ${label} ${t(label)} ${t(stateByCode.get(race.state)?.name || "")}`.toLowerCase().includes(search.toLowerCase());
  }).sort((a, b) => closeness(a) - closeness(b)), [context.chamber, context.stateCode, overview, rating, search, shownChamber, t, view]);
  const tableRef = useFlipList<HTMLDivElement>(view === "list" ? races.map((race) => race.key).join() : "");

  const mapRaces = races.filter((race) => race.chamber === shownChamber);
  const filtering = Boolean(search) || rating !== "all";
  const matches = useMemo(() => filtering ? new Set(mapRaces.map((race) => race.code)) : null, [filtering, mapRaces]);
  const slug = (race: RaceOverview) => race.chamber === "senate" ? `${race.code.toLowerCase()}-senate` : race.code.toLowerCase();
  const raceLabel = (race: RaceOverview) => race.chamber === "senate" ? t("{state} Senate", { state: t(stateByCode.get(race.state)?.name || race.state) }) : race.code;
  const openRace = (race: RaceOverview) => router.push(localize(`/races/${slug(race)}`));
  const pollCell = (race: RaceOverview) => race.polls ? <b className={tone(race.polls.margin)}>{lean(race, race.polls.margin)}<small>{t("{n} polls", { n: race.polls.polls })}</small></b> : <span className="muted-cell">—</span>;
  const marketCell = (race: RaceOverview) => race.market !== null ? <b className={tone(race.market - .5)}>{Math.round((race.market >= .5 ? race.market : 1 - race.market) * 100)}% {race.market >= .5 ? race.side : "R"}</b> : <span className="muted-cell">—</span>;

  return <>
    <section className="page-intro"><div><p className="eyebrow">{t("HOUSE + SENATE · 470 RACES")}</p><h1>{t("Every race, on the map and in the list")}</h1><p>{t("Explore the map or search the list: both share the same filters. Open any race for its candidates, money, polls and history.")}</p></div><div className="stat-stamp"><strong><CountUp value={view === "map" ? mapRaces.length : races.length} /></strong><span>{t("races in view")}</span><small>{overview ? t("Ratings, polls and markets") : t("Loading…")}</small></div></section>

    <section className="races-toolbar">
      <div className="races-view-switch" role="tablist" aria-label={t("View")}>
        <button type="button" role="tab" aria-selected={view === "map"} className={view === "map" ? "active" : ""} onClick={() => chooseView("map")}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 5l5-2 6 2 5-2v12l-5 2-6-2-5 2z M7 3v12 M13 5v12" /></svg>{t("Map")}</button>
        <button type="button" role="tab" aria-selected={view === "list"} className={view === "list" ? "active" : ""} onClick={() => chooseView("list")}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14 M3 10h14 M3 15h14" /></svg>{t("List")}</button>
      </div>
      <div className="race-directory-filters">
        <label>{t("Search")}<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("PA-07, Alaska, Toss Up…")} /></label>
        <label>{t("State")}<select value={context.stateCode} onChange={(event) => context.setContext({ stateCode: event.target.value })}><option value="US">{t("All states")}</option>{states.map((state) => <option key={state.code} value={state.code}>{t(state.name)}</option>)}</select></label>
        <label>{t("Chamber")}<select value={context.chamber} onChange={(event) => context.setContext({ chamber: event.target.value as "all" | "house" | "senate" })}><option value="all">{t("Both")}</option><option value="house">{t("House")}</option><option value="senate">{t("Senate")}</option></select></label>
        <label>{t("Rating")}<select value={rating} onChange={(event) => setRating(event.target.value as RatingFilter)}><option value="all">{t("All ratings")}</option><option value="competitive">{t("Competitive (Lean or closer)")}</option><option value="toss">{t("Toss-ups only")}</option></select></label>
      </div>
    </section>

    {view === "map" ? <section className="district-layout races-map-layout">
      <article className="panel district-map-panel">
        <div className="panel-head races-map-head">
          <div className="segmented" role="group" aria-label={t("Chamber")}>{(["house", "senate"] as const).map((chamber) => <button key={chamber} type="button" disabled={context.chamber !== "all" && context.chamber !== chamber} className={shownChamber === chamber ? "selected" : ""} aria-pressed={shownChamber === chamber} onClick={() => setMapChamber(chamber)}>{chamber === "house" ? t("House · 435 districts") : t("Senate · 35 races")}</button>)}</div>
          <div className="district-legend"><span><i className="dem" /> {t("Favours D")}</span><span><i className="toss" /> {t("Toss-up")}</span><span><i className="rep" /> {t("Favours R")}</span>{shownChamber === "senate" && <span><i className="neutral" /> {t("No race in 2026")}</span>}</div>
        </div>
        {overview ? <RaceMap chamber={shownChamber} races={overview.races} matches={matches} stateCode={context.stateCode} hovered={hovered} onHover={setHovered}
          onState={(code) => { if (shownChamber === "senate" && code !== "US") router.push(localize(`/states/${code.toLowerCase()}`)); else context.setContext({ stateCode: code }); }}
          onOpen={openRace} /> : <div className="map-loading">{t("Loading Census boundaries and model output…")}</div>}
        <div className="races-map-foot"><p className="chart-note">{shownChamber === "house" ? t("Click a district to zoom into its state; click again to open the race.") : t("Click a state to open its Senate race.")} {t("Colours: the consensus of Cook, Inside Elections and Sabato.")}</p></div>
      </article>
      <aside className="panel district-rankings">
        <div className="panel-head"><div><p className="eyebrow">{t("COMPETITIVENESS")}</p><h2>{t("Closest in view")}</h2></div><span className="panel-tag">{t("by rating, then polls")}</span></div>
        <div className="district-race-list">
          {mapRaces.slice(0, 30).map((race) => <Link key={race.key} className={hovered === race.code ? "linked" : undefined} href={`/races/${slug(race)}`} onMouseEnter={() => setHovered(race.code)} onMouseLeave={() => setHovered("")}><span><strong>{raceLabel(race)}</strong><small className={tone(race.rating?.score ?? 0)}>{t(race.rating?.label || "Unrated")}</small></span><b className={race.polls ? tone(race.polls.margin) : ""}>{race.polls ? lean(race, race.polls.margin) : "—"}</b><em>{race.polls ? t("polls") : t("no polls")}</em></Link>)}
          {overview && mapRaces.length === 0 && <p className="table-empty">{t("No races match the selected filters.")}</p>}
        </div>
        {mapRaces.length > 30 && <button type="button" className="text-button" onClick={() => chooseView("list")}>{t("See all {count} races →", { count: mapRaces.length })}</button>}
      </aside>
    </section> : <section className="panel races-directory">
      <div className="race-directory-table mpb-directory" ref={tableRef}>
        <div className="race-directory-head"><span>{t("Contest")}</span><span>{t("Rating")}</span><span>Cook · IE · Sabato</span><span>{t("Polls")}</span><span>{t("Markets")}</span><span>{t("2024 result")}</span></div>
        {races.map((race) => <Link key={race.key} data-flip={race.key} href={`/races/${slug(race)}`}><span><strong>{race.chamber === "senate" ? t("{code} Senate", { code: race.code }) : race.code}</strong><small>{race.chamber === "house" ? t("U.S. House") : t("U.S. Senate")}</small></span><span className={tone(race.rating?.score ?? 0)}>{t(race.rating?.label || "Unrated")}</span><ExpertCell race={race} />{pollCell(race)}{marketCell(race)}<em>{race.baseline !== null ? lean(race, race.baseline) : "—"} <i className="mpb-arrow" aria-hidden="true">→</i></em></Link>)}
        {overview && races.length === 0 && <p className="table-empty">{t("No races match the selected filters.")}</p>}
      </div>
    </section>}
  </>;
}
