"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/i18n/link";
import { useLocalePath, useT } from "@/components/i18n/locale-provider";
import { StateTileMap } from "@/components/state-tile-map";
import { StateGeoMap } from "@/components/states/state-geo-map";
import type { StateSummary } from "@/lib/state-summary";
import "./states.css";

type Lens = "house" | "senate" | "president";
type Filter = "all" | "senate" | "competitive";
type Sort = "competitive" | "seats" | "name" | "lean";
const signed = (value: number) => `${value >= 0 ? "D" : "R"}+${Math.abs(value).toFixed(1)}`;

// Directory of the 50 states: a clickable tile map with three lenses, then one card per state.
export function StatesDirectory({ states }: { states: StateSummary[] }) {
  const t = useT();
  const router = useRouter();
  const localize = useLocalePath();
  const [lens, setLens] = useState<Lens>("house");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("competitive");
  const [query, setQuery] = useState("");
  const [shape, setShape] = useState<"geo" | "tiles">("geo");

  // Map values on the shared D+ / R+ colour scale.
  const values = useMemo(() => Object.fromEntries(states.flatMap((state) => {
    if (lens === "president") return state.president2024 === null ? [] : [[state.code, state.president2024]];
    if (lens === "senate") return state.senate.length ? [[state.code, state.senate[0].margin]] : [];
    // House: expected Democratic share of the delegation, mapped to ±50 so a split delegation is neutral.
    return state.seats ? [[state.code, (state.expectedD / state.seats - .5) * 60]] : [];
  })), [lens, states]);

  const note = (code: string) => {
    const state = states.find((item) => item.code === code);
    if (!state) return undefined;
    if (lens === "house") return t("{d} of {n} seats expected D · {c} in play", { d: state.expectedD.toFixed(1), n: state.seats, c: state.competitive });
    if (lens === "senate") return state.senate.length ? t("Senate: {p}% D", { p: state.senate[0].pD }) : t("No Senate race in 2026");
    return t("2024 presidential result");
  };

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return states
      .filter((state) => filter === "all" || (filter === "senate" ? state.senate.length > 0 : state.competitive > 0 || state.senate.some((race) => race.pD > 20 && race.pD < 80)))
      .filter((state) => !needle || `${state.name} ${t(state.name)} ${state.code}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        if (sort === "name") return t(a.name).localeCompare(t(b.name));
        if (sort === "seats") return b.seats - a.seats;
        if (sort === "lean") return (b.president2024 ?? 0) - (a.president2024 ?? 0);
        const heat = (state: StateSummary) => state.competitive * 2 + state.senate.filter((race) => race.pD > 20 && race.pD < 80).length * 3;
        return heat(b) - heat(a) || b.seats - a.seats;
      });
  }, [filter, query, sort, states, t]);

  const totals = useMemo(() => ({ seats: states.reduce((sum, state) => sum + state.seats, 0), competitive: states.reduce((sum, state) => sum + state.competitive, 0), senate: states.reduce((sum, state) => sum + state.senate.length, 0) }), [states]);

  return <>
    <section className="page-intro"><div>
      <p className="eyebrow">{t("STATE DIRECTORY")}</p>
      <h1>{t("Fifty states, every race")}</h1>
      <p>{t("Pick a state to see its Senate race, every House district and how it votes. The map switches between the House delegation, the Senate races and the 2024 presidential result.")}</p>
    </div><div className="stat-stamp"><strong>{totals.competitive}</strong><span>{t("House seats in play")}</span><small>{t("{s} Senate races · {h} House seats", { s: totals.senate, h: totals.seats })}</small></div></section>

    <section className="panel states-map-panel">
      <div className="panel-head">
        <div><p className="eyebrow">{t("MAP")}</p><h2>{lens === "house" ? t("House delegation, expected") : lens === "senate" ? t("Senate races, 2026 model") : t("President, 2024")}</h2></div>
        <div className="segmented" role="group" aria-label={t("Map lens")}>{([["house", t("House")], ["senate", t("Senate")], ["president", t("President 2024")]] as const).map(([key, label]) => <button key={key} type="button" className={lens === key ? "selected" : ""} aria-pressed={lens === key} onClick={() => setLens(key)}>{label}</button>)}</div>
      </div>
      {shape === "geo"
        ? <StateGeoMap values={values} label={t("State map")} onSelect={(code) => router.push(localize(`/states/${code.toLowerCase()}`))} note={note} />
        : <StateTileMap values={values} label={t("State map")} onSelect={(code) => router.push(localize(`/states/${code.toLowerCase()}`))} note={note} />}
      <div className="states-map-foot">
        <p className="chart-note">{t("Click a state to open it.")}</p>
        <div className="segmented small" role="group" aria-label={t("Map type")}><button type="button" className={shape === "geo" ? "selected" : ""} aria-pressed={shape === "geo"} onClick={() => setShape("geo")}>{t("Geographic")}</button><button type="button" className={shape === "tiles" ? "selected" : ""} aria-pressed={shape === "tiles"} onClick={() => setShape("tiles")}>{t("Tiles")}</button></div>
      </div>
    </section>

    <section className="states-controls">
      <label>{t("Search")}<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Arizona, PA…")} /></label>
      <div className="segmented" role="group" aria-label={t("Filter")}>{([["all", t("All")], ["senate", t("With a Senate race")], ["competitive", t("Competitive")]] as const).map(([key, label]) => <button key={key} type="button" className={filter === key ? "selected" : ""} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>
      <label>{t("Sort")}<select value={sort} onChange={(event) => setSort(event.target.value as Sort)}><option value="competitive">{t("Most contested")}</option><option value="seats">{t("Most House seats")}</option><option value="lean">{t("Most Democratic")}</option><option value="name">{t("Name")}</option></select></label>
    </section>

    <section className="states-grid">
      {shown.map((state) => {
        const share = state.seats ? state.expectedD / state.seats * 100 : 50;
        return <Link key={state.code} href={`/states/${state.code.toLowerCase()}`} className="state-card">
          <header><span className="state-code">{state.code}</span><h3>{t(state.name)}</h3>{state.president2024 !== null && <small className={state.president2024 >= 0 ? "dem-text" : "rep-text"} title={t("2024 presidential result")}>{signed(state.president2024)}</small>}</header>
          <div className="state-card-house">
            <span>{state.seats === 1 ? t("1 House seat") : t("{n} House seats", { n: state.seats })}{state.competitive > 0 && <b> · {t("{n} in play", { n: state.competitive })}</b>}</span>
            <div className="state-card-bar" aria-hidden="true"><i className="dem" style={{ width: `${share}%` }} /><i className="rep" style={{ width: `${100 - share}%` }} /></div>
            <small>{t("{d} D · {r} R expected", { d: state.expectedD.toFixed(1), r: (state.seats - state.expectedD).toFixed(1) })}</small>
          </div>
          {state.senate.length > 0
            ? state.senate.map((race) => <div key={race.code + race.special} className="state-card-senate"><span>{race.special ? t("Senate (special)") : t("Senate")}</span><b className={race.pD >= 50 ? "dem-text" : "rep-text"}>{race.pD >= 50 ? `${race.pD}% D` : `${100 - race.pD}% R`}</b></div>)
            : <div className="state-card-senate muted"><span>{t("No Senate race in 2026")}</span></div>}
          <em>{t("Open state →")}</em>
        </Link>;
      })}
      {shown.length === 0 && <p className="table-empty">{t("No states match.")}</p>}
    </section>
  </>;
}
