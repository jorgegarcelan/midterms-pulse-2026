"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MarginHistoryChart } from "@/components/charts/margin-history-chart";
import { DemographicCompare } from "@/components/demographics/demographic-compare";
import { stateByCode } from "@/data/geography";
import type { ForecastRace } from "@/lib/forecast";
import { loadDemographics, loadHouseHistory, loadPresidentHistory, type Demographics, type HistoryResult } from "@/lib/race-data";
import { raceSlug } from "@/lib/races";
import { ShareImageButton } from "@/components/share-image-button";

type Row = { code: string; race?: ForecastRace; last?: HistoryResult; income: number | null; bachelors: number | null; white: number | null; hispanic: number | null; black: number | null };
type SortKey = "code" | "model" | "last" | "income" | "bachelors" | "white" | "hispanic" | "black";

const signed = (value: number) => `${value >= 0 ? "D" : "R"}+${Math.abs(value).toFixed(1)}`;
const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "code", label: "District" }, { key: "model", label: "2026 model" }, { key: "last", label: "2024 House" }, { key: "income", label: "Median income" },
  { key: "bachelors", label: "Bachelor's+" }, { key: "white", label: "White" }, { key: "hispanic", label: "Hispanic" }, { key: "black", label: "Black" },
];

function sortValue(row: Row, key: SortKey) {
  switch (key) {
    case "code": return row.code;
    case "model": return row.race?.signedMargin ?? -999;
    case "last": return row.last ? (row.last.u ? (row.last.w === "D" ? 100 : -100) : row.last.m) : -999;
    default: return row[key] ?? -1;
  }
}

// State page: Census profile against the nation, presidential history, and every district side by side.
export function StateProfile({ code }: { code: string }) {
  const state = code.toUpperCase();
  const name = stateByCode.get(state)?.name || state;
  const [demographics, setDemographics] = useState<Demographics | null>(null);
  const [president, setPresident] = useState<HistoryResult[] | null>(null);
  const [house, setHouse] = useState<Record<string, HistoryResult[]>>({});
  const [races, setRaces] = useState<ForecastRace[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; direction: 1 | -1 }>({ key: "code", direction: 1 });

  useEffect(() => {
    let cancelled = false;
    loadDemographics().then((data) => { if (!cancelled) setDemographics(data); }).catch(() => undefined);
    loadPresidentHistory().then((data) => { if (!cancelled) setPresident(data.states[state] || []); }).catch(() => undefined);
    loadHouseHistory(state).then((data) => { if (!cancelled) setHouse(data.districts); }).catch(() => undefined);
    fetch("/api/model").then((response) => response.json() as Promise<{ races: ForecastRace[] }>).then((model) => { if (!cancelled) setRaces(model.races.filter((race) => race.state === state)); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [state]);

  const senateRace = races.find((race) => race.chamber === "senate");
  const rows = useMemo<Row[]>(() => {
    if (!demographics) return [];
    return Object.entries(demographics.districts).filter(([key]) => key.startsWith(`${state}-`)).map(([key, profile]) => ({
      code: key, race: races.find((race) => race.chamber === "house" && race.code === key), last: house[key]?.findLast((result) => result.y === 2024),
      income: profile.medianIncome, bachelors: profile.bachelors, white: profile.race.white, hispanic: profile.race.hispanic, black: profile.race.black,
    }));
  }, [demographics, house, races, state]);
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const left = sortValue(a, sort.key);
    const right = sortValue(b, sort.key);
    return (typeof left === "string" ? left.localeCompare(String(right)) : left - (right as number)) * sort.direction;
  }), [rows, sort]);

  const profile = demographics?.states[state];
  const lastPresident = president?.at(-1);

  return (
    <section className="state-profile" aria-labelledby="state-profile-title">
      <div className="state-profile-head">
        <div><p className="eyebrow">State profile</p><h2 id="state-profile-title">{name} at a glance</h2><ShareImageButton href={`/api/share/state/${state.toLowerCase()}`} /></div>
        <div className="state-chips">
          {profile?.population && <span><b>{new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(profile.population)}</b> residents</span>}
          <span><b>{rows.length || "—"}</b> House {rows.length === 1 ? "seat" : "seats"}</span>
          {lastPresident && <span><b className={lastPresident.m >= 0 ? "dem-text" : "rep-text"}>{signed(lastPresident.m)}</b> for president in 2024</span>}
          {senateRace && <Link href={`/races/${raceSlug(senateRace)}`}><b>Senate race</b> {signed(senateRace.signedMargin)} →</Link>}
        </div>
      </div>

      <div className="state-profile-grid">
        <article className="panel">
          <div className="panel-head"><div><p className="eyebrow">Census profile</p><h2>{name} vs. the country</h2></div><span className="panel-tag">{demographics?.release || "ACS"}</span></div>
          {demographics && profile ? <DemographicCompare geos={[{ key: state, label: name, profile }, { key: "US", label: "United States", profile: demographics.us }]} demographics={demographics} /> : <div className="chart-loading">Loading Census data…</div>}
        </article>
        <article className="panel">
          <div className="panel-head"><div><p className="eyebrow">Presidential results</p><h2>{name} since 1976</h2></div><span className="panel-tag">MIT Election Lab</span></div>
          {president?.length ? <MarginHistoryChart
            points={president.map((result) => ({ year: result.y, margin: result.m, winner: result.w, title: `${result.y} · President`, detail: `D ${result.dp}% · R ${result.rp}%` }))}
            label="President"
            ariaLabel={`Presidential margin in ${name}, 1976 to 2024`}
          /> : <div className="chart-loading">Loading results…</div>}
          <p className="chart-note">Two-party margin of the presidential vote in the state (Democratic share minus Republican share of all votes cast).</p>
        </article>
      </div>

      {rows.length > 0 && <article className="panel state-districts">
        <div className="panel-head"><div><p className="eyebrow">Districts</p><h2>Every {name} district, side by side</h2></div><span className="panel-tag">click a column to sort</span></div>
        <div className="district-table" role="table">
          <div className="district-table-head" role="row">
            {COLUMNS.map((column) => <button key={column.key} type="button" role="columnheader" aria-sort={sort.key === column.key ? (sort.direction === 1 ? "ascending" : "descending") : "none"} className={sort.key === column.key ? "active" : ""} onClick={() => setSort((current) => ({ key: column.key, direction: current.key === column.key ? (current.direction === 1 ? -1 : 1) : column.key === "code" ? 1 : -1 }))}>{column.label}{sort.key === column.key ? (sort.direction === 1 ? " ↑" : " ↓") : ""}</button>)}
          </div>
          {sorted.map((row) => (
            <Link key={row.code} role="row" href={`/races/${row.code.toLowerCase()}`}>
              <strong>{row.code}</strong>
              <b className={row.race ? (row.race.signedMargin >= 0 ? "dem-text" : "rep-text") : ""}>{row.race ? signed(row.race.signedMargin) : "—"}</b>
              <span className={row.last ? (row.last.w === "D" ? "dem-text" : row.last.w === "R" ? "rep-text" : "") : ""}>{row.last ? (row.last.u ? `${row.last.w} unopposed` : signed(row.last.m)) : "—"}</span>
              <span>{row.income ? `$${Math.round(row.income / 1000)}k` : "—"}</span>
              <span>{row.bachelors ?? "—"}%</span>
              <span>{row.white ?? "—"}%</span>
              <span>{row.hispanic ?? "—"}%</span>
              <span>{row.black ?? "—"}%</span>
            </Link>
          ))}
        </div>
        <p className="chart-note">2024 House results from FiveThirtyEight; demographics from the {demographics?.release}; 2026 margins from the MP-26 model.</p>
      </article>}
    </section>
  );
}
