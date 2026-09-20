"use client";

import { useEffect, useMemo, useState } from "react";
import { geoAlbersUsa, geoPath } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";
import Papa from "papaparse";

type Cycle = "2016" | "2020" | "2024";
type Scope = "national" | "state" | "county";
type MapMetric = "margin" | "shift";
type CountyProperties = { GEO_ID: string; STATE: string; COUNTY: string; NAME: string; LSAD: string };
type CountyRow = {
  fips: string; state: string; county: string; votesDem: number; votesRep: number; totalVotes: number;
  demShare: number; repShare: number; shiftRep: number; population: number; medianAge: number;
  medianIncome: number; bachelorsRate: number; povertyRate: number; unemploymentRate: number;
};

const cycles: Cycle[] = ["2016", "2020", "2024"];

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function marginColor(margin: number) {
  if (margin >= 35) return "#9f2633";
  if (margin >= 15) return "#c4414d";
  if (margin >= 5) return "#df7a82";
  if (margin > -5) return "#88777d";
  if (margin > -15) return "#7899dc";
  if (margin > -35) return "#4d7fe1";
  return "#2d58ad";
}

function parseRows(text: string) {
  const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  return result.data.map((row): CountyRow => ({
    fips: String(row.county_fips || "").padStart(5, "0"), state: row.state, county: row.county,
    votesDem: number(row.votes_dem), votesRep: number(row.votes_gop), totalVotes: number(row.total_votes),
    demShare: number(row.per_dem), repShare: number(row.per_gop), shiftRep: number(row.delta_per_gop),
    population: number(row.pop_total), medianAge: number(row.median_age), medianIncome: number(row.median_income),
    bachelorsRate: number(row.bachelors_rate), povertyRate: number(row.poverty_rate), unemploymentRate: number(row.unemployment_rate),
  })).filter((row) => row.fips.length === 5 && row.county);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function CountyTrend({ rows }: { rows: { cycle: Cycle; row: CountyRow }[] }) {
  if (!rows.length) return null;
  return <div className="county-trend">{rows.map(({ cycle, row }) => {
    const margin = (row.demShare - row.repShare) * 100;
    const style = margin >= 0
      ? { width: `${Math.min(50, Math.abs(margin)) * 2}%`, left: "50%" }
      : { width: `${Math.min(50, Math.abs(margin)) * 2}%`, right: "50%" };
    return <div key={cycle}><span>{cycle}</span><div className="county-trend-track"><i className={margin >= 0 ? "dem" : "rep"} style={style} /></div><strong className={margin >= 0 ? "dem-text" : "rep-text"}>{margin >= 0 ? "D" : "R"}+{Math.abs(margin).toFixed(1)}</strong></div>;
  })}</div>;
}

export function GeographyExplorer() {
  const [data, setData] = useState<Record<Cycle, CountyRow[]> | null>(null);
  const [geography, setGeography] = useState<FeatureCollection<Geometry, CountyProperties> | null>(null);
  const [cycle, setCycle] = useState<Cycle>("2024");
  const [scope, setScope] = useState<Scope>("national");
  const [metric, setMetric] = useState<MapMetric>("margin");
  const [state, setState] = useState("Arizona");
  const [selectedFips, setSelectedFips] = useState("04013");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/data/county-2016.csv").then((response) => response.text()),
      fetch("/data/county-2020.csv").then((response) => response.text()),
      fetch("/data/county-2024.csv").then((response) => response.text()),
      fetch("/data/counties.json").then((response) => response.json() as Promise<FeatureCollection<Geometry, CountyProperties>>),
    ]).then(([data2016, data2020, data2024, map]) => {
      if (cancelled) return;
      setData({ "2016": parseRows(data2016), "2020": parseRows(data2020), "2024": parseRows(data2024) });
      setGeography(map);
    }).catch(() => { if (!cancelled) setError("The county archive could not be loaded."); });
    return () => { cancelled = true; };
  }, []);

  const currentRows = useMemo(() => data?.[cycle] || [], [cycle, data]);
  const states = useMemo(() => [...new Set((data?.["2024"] || []).map((row) => row.state))].sort(), [data]);
  const visibleRows = useMemo(() => scope === "national" ? currentRows : currentRows.filter((row) => row.state === state), [currentRows, scope, state]);
  const lookup = useMemo(() => new Map(currentRows.map((row) => [row.fips, row])), [currentRows]);
  const selected = lookup.get(selectedFips) || visibleRows[0];
  const countyOptions = useMemo(() => (scope === "national" ? currentRows : currentRows.filter((row) => row.state === state)).map((row) => `${row.county}, ${row.state}`), [currentRows, scope, state]);
  const totals = useMemo(() => visibleRows.reduce((sum, row) => ({ dem: sum.dem + row.votesDem, rep: sum.rep + row.votesRep, total: sum.total + row.totalVotes, population: sum.population + row.population }), { dem: 0, rep: 0, total: 0, population: 0 }), [visibleRows]);
  const demPct = totals.total ? totals.dem / totals.total * 100 : 0;
  const repPct = totals.total ? totals.rep / totals.total * 100 : 0;
  const areaMargin = demPct - repPct;
  const movers = useMemo(() => [...visibleRows].sort((a, b) => Math.abs(b.shiftRep) - Math.abs(a.shiftRep)).slice(0, 12), [visibleRows]);
  const selectedTrend = useMemo(() => data ? cycles.flatMap((item) => { const row = data[item].find((county) => county.fips === selected?.fips); return row ? [{ cycle: item, row }] : []; }) : [], [data, selected?.fips]);

  const paths = useMemo(() => {
    if (!geography) return [];
    const projection = geoAlbersUsa().fitSize([980, 590], geography);
    const generator = geoPath(projection);
    return geography.features.map((feature) => ({ feature, path: generator(feature) || "", fips: `${feature.properties.STATE}${feature.properties.COUNTY}` }));
  }, [geography]);

  function changeScope(next: Scope) {
    setScope(next);
    if (next === "national") return;
    const first = currentRows.find((row) => row.state === state) || currentRows[0];
    if (first) { setState(first.state); setSelectedFips(first.fips); }
  }

  function changeState(next: string) {
    setState(next);
    const first = currentRows.find((row) => row.state === next);
    if (first) setSelectedFips(first.fips);
  }

  function chooseCounty(label: string) {
    const match = currentRows.find((row) => `${row.county}, ${row.state}` === label);
    if (match) { setState(match.state); setSelectedFips(match.fips); setScope("county"); }
  }

  return (
    <>
      <section className="explorer-toolbar panel">
        <div className="explorer-title"><p className="eyebrow">RESULTS · 2016–2024</p><h1>Geographic results explorer</h1></div>
        <div className="explorer-controls">
          <div className="control-group"><span>Level</span><div className="segmented">{(["national", "state", "county"] as Scope[]).map((item) => <button className={scope === item ? "selected" : ""} key={item} onClick={() => changeScope(item)}>{item}</button>)}</div></div>
          <label>Cycle<select value={cycle} onChange={(event) => setCycle(event.target.value as Cycle)}>{cycles.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Map<select value={metric} onChange={(event) => setMetric(event.target.value as MapMetric)}><option value="margin">Two-party margin</option><option value="shift">Shift from prior cycle</option></select></label>
          {scope !== "national" && <label>State<select value={state} onChange={(event) => changeState(event.target.value)}>{states.map((item) => <option key={item}>{item}</option>)}</select></label>}
          {scope === "county" && <label>County<input list="county-list" placeholder="Search county" onChange={(event) => chooseCounty(event.target.value)} /><datalist id="county-list">{countyOptions.map((item) => <option key={item} value={item} />)}</datalist></label>}
        </div>
      </section>

      {error ? <section className="panel data-error">{error}</section> : !data || !geography ? <section className="panel data-loading">Loading 3,000+ counties across three election cycles…</section> : <>
        <section className="geo-kpis">
          <article><span>Two-party margin</span><strong className={areaMargin >= 0 ? "dem-text" : "rep-text"}>{areaMargin >= 0 ? "D" : "R"}+{Math.abs(areaMargin).toFixed(1)}</strong><small>{scope === "national" ? "United States" : state} · {cycle}</small></article>
          <article><span>Votes represented</span><strong>{formatCompact(totals.total)}</strong><small>{visibleRows.length.toLocaleString()} counties</small></article>
          <article><span>Democratic share</span><strong className="dem-text">{demPct.toFixed(1)}%</strong><small>{formatCompact(totals.dem)} votes</small></article>
          <article><span>Republican share</span><strong className="rep-text">{repPct.toFixed(1)}%</strong><small>{formatCompact(totals.rep)} votes</small></article>
        </section>

        <section className="geography-grid">
          <article className="panel county-map-panel">
            <div className="panel-head"><div><p className="eyebrow">COUNTY MAP</p><h2>{metric === "margin" ? "Two-party margin" : "Republican shift"} · {cycle}</h2></div><span className="panel-tag">Click any county</span></div>
            <div className="county-map-scroll"><svg className="county-map" viewBox="0 0 980 590" role="img" aria-label={`County map for the ${cycle} election`}>
              {paths.map(({ feature, path, fips }) => { const row = lookup.get(fips); const inScope = scope === "national" || row?.state === state; const value = metric === "margin" ? ((row?.repShare || 0) - (row?.demShare || 0)) * 100 : (row?.shiftRep || 0); return <path key={fips} d={path} fill={row ? marginColor(value) : "#20252c"} opacity={inScope ? 1 : .18} stroke={selected?.fips === fips ? "#f1ede4" : "#0e1115"} strokeWidth={selected?.fips === fips ? 1.8 : .22} onClick={() => { if (row) { setSelectedFips(fips); setState(row.state); setScope("county"); } }}><title>{row ? `${row.county}, ${row.state}: ${value >= 0 ? "R" : "D"}+${Math.abs(value).toFixed(1)}` : feature.properties.NAME}</title></path>; })}
            </svg></div>
            <div className="map-legend"><span>Strong R</span><i className="legend-gradient" /><span>Strong D</span></div>
          </article>

          <aside className="panel county-profile">
            {selected && <><p className="eyebrow">COUNTY PROFILE</p><h2>{selected.county}</h2><span className="county-state">{selected.state} · FIPS {selected.fips}</span>
              <div className="county-result"><div><span>Democratic</span><strong className="dem-text">{(selected.demShare * 100).toFixed(1)}%</strong></div><div><span>Republican</span><strong className="rep-text">{(selected.repShare * 100).toFixed(1)}%</strong></div></div>
              <CountyTrend rows={selectedTrend} />
              <dl className="county-facts"><div><dt>Population</dt><dd>{selected.population.toLocaleString()}</dd></div><div><dt>Median income</dt><dd>${selected.medianIncome.toLocaleString()}</dd></div><div><dt>Median age</dt><dd>{selected.medianAge.toFixed(1)}</dd></div><div><dt>Bachelor&apos;s degree</dt><dd>{selected.bachelorsRate.toFixed(1)}%</dd></div><div><dt>Poverty</dt><dd>{selected.povertyRate.toFixed(1)}%</dd></div><div><dt>Unemployment</dt><dd>{selected.unemploymentRate.toFixed(1)}%</dd></div></dl>
              <p className="chart-note">Election returns: County by County / MIT Election Data and Science Lab. Demographics: Census ACS.</p>
            </>}
          </aside>
        </section>

        <section className="panel movers-panel"><div className="panel-head"><div><p className="eyebrow">LARGEST MOVEMENT</p><h2>Counties shifting most since the prior cycle</h2></div><span className="panel-tag">{scope === "national" ? "All states" : state}</span></div><div className="movers-table"><div className="movers-head"><span>County</span><span>State</span><span>{cycle} margin</span><span>R shift</span><span>Total votes</span></div>{movers.map((row) => { const margin = (row.demShare - row.repShare) * 100; return <button key={row.fips} onClick={() => { setSelectedFips(row.fips); setState(row.state); setScope("county"); }}><strong>{row.county}</strong><span>{row.state}</span><span className={margin >= 0 ? "dem-text" : "rep-text"}>{margin >= 0 ? "D" : "R"}+{Math.abs(margin).toFixed(1)}</span><span className={row.shiftRep >= 0 ? "rep-text" : "dem-text"}>{row.shiftRep >= 0 ? "R" : "D"}+{Math.abs(row.shiftRep).toFixed(1)} pp</span><span>{row.totalVotes.toLocaleString()}</span></button>; })}</div></section>
      </>}
    </>
  );
}
