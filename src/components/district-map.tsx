"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { geoAlbersUsa, geoPath } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";
import { useElectionContext } from "@/components/election-context";
import { stateCodeByFips, stateFips } from "@/data/geography";
import type { ForecastRace } from "@/lib/forecast";

type DistrictProperties = { GEOID: string; STATEFP: string; CD119FP: string; NAMELSAD: string };
type DistrictCollection = FeatureCollection<Geometry, DistrictProperties> & { source?: string };
type ModelFeed = { races: ForecastRace[]; runDate: string; version: string };

function districtCode(feature: DistrictCollection["features"][number]) {
  return `${stateCodeByFips.get(feature.properties.STATEFP) || ""}-${feature.properties.CD119FP}`;
}

function fill(race?: ForecastRace) {
  if (!race) return "#2b3035";
  const intensity = Math.min(1, Math.abs(race.signedMargin) / 18);
  if (race.leader === "D") return `color-mix(in srgb, #4d7fe1 ${Math.round(45 + intensity * 45)}%, #303640)`;
  return `color-mix(in srgb, #d84d59 ${Math.round(45 + intensity * 45)}%, #303640)`;
}

export function DistrictMap() {
  const router = useRouter();
  const { stateCode, setContext } = useElectionContext();
  const [geography, setGeography] = useState<DistrictCollection | null>(null);
  const [model, setModel] = useState<ModelFeed | null>(null);
  const [hovered, setHovered] = useState("");
  const [search, setSearch] = useState("");
  const [competitiveOnly, setCompetitiveOnly] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/data/congressional-districts-119.geojson", { signal: controller.signal }).then((response) => response.json() as Promise<DistrictCollection>),
      fetch("/api/model", { signal: controller.signal }).then((response) => response.json() as Promise<ModelFeed>),
    ]).then(([geo, nextModel]) => { setGeography(geo); setModel(nextModel); }).catch(() => undefined);
    return () => controller.abort();
  }, []);

  const raceByCode = useMemo(() => new Map((model?.races || []).filter((race) => race.chamber === "house").map((race) => [race.code, race])), [model]);
  const visibleFeatures = useMemo(() => {
    if (!geography) return [];
    const fips = stateFips[stateCode];
    return fips ? geography.features.filter((feature) => feature.properties.STATEFP === fips && feature.properties.CD119FP !== "98") : geography.features.filter((feature) => Number(feature.properties.STATEFP) <= 56 && feature.properties.CD119FP !== "98");
  }, [geography, stateCode]);
  const paths = useMemo(() => {
    if (!geography || visibleFeatures.length === 0) return [];
    const collection: FeatureCollection<Geometry, DistrictProperties> = { type: "FeatureCollection", features: visibleFeatures };
    const projection = geoAlbersUsa().fitExtent([[18, 18], [942, 552]], collection);
    const draw = geoPath(projection);
    return visibleFeatures.map((feature) => ({ feature, code: districtCode(feature), path: draw(feature) || "" }));
  }, [geography, visibleFeatures]);

  const races = useMemo(() => (model?.races || [])
    .filter((race) => race.chamber === "house" && (stateCode === "US" || race.state === stateCode))
    .filter((race) => !competitiveOnly || race.margin <= 5)
    .filter((race) => !search || `${race.code} ${race.rating}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.margin - b.margin), [competitiveOnly, model, search, stateCode]);
  const hoveredRace = raceByCode.get(hovered);

  function openRace(code: string) {
    const race = raceByCode.get(code);
    if (!race) return;
    setContext({ stateCode: race.state, chamber: "house" });
    router.push(`/races/${code.toLowerCase()}`);
  }

  return <>
    <section className="page-intro district-intro">
      <div><p className="eyebrow">119TH CONGRESS · 435 VOTING DISTRICTS</p><h1>Congressional district map</h1><p>Inspect every House district, isolate a state and move directly into the underlying race profile. Color shows the current Midterm Pulse v0.1 lean; gray means no modeled match.</p></div>
      <div className="stat-stamp"><strong>{races.length}</strong><span>{stateCode === "US" ? "districts in view" : `${stateCode} districts`}</span><small>{model?.runDate || "Loading model…"}</small></div>
    </section>
    <section className="district-toolbar" aria-label="District map controls">
      <label>Find a district<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="AZ-01 or Toss Up" /></label>
      <label className="check-control"><input type="checkbox" checked={competitiveOnly} onChange={(event) => setCompetitiveOnly(event.target.checked)} /> Competitive only (≤5 pts)</label>
      <div className="district-legend"><span><i className="dem" /> Democratic lead</span><span><i className="neutral" /> Unmatched</span><span><i className="rep" /> Republican lead</span></div>
    </section>
    <section className="district-layout">
      <article className="panel district-map-panel">
        {!geography || !model ? <div className="map-loading">Loading Census boundaries and model output…</div> : <svg viewBox="0 0 960 570" role="img" aria-label={`Congressional districts for ${stateCode === "US" ? "the United States" : stateCode}`}>
          {paths.map(({ feature, code, path }) => {
            const race = raceByCode.get(code);
            return <path key={feature.properties.GEOID} d={path} fill={fill(race)} className={hovered === code ? "hovered" : ""} tabIndex={race ? 0 : -1} role={race ? "link" : undefined} aria-label={race ? `${code}, ${race.leader} leads by ${race.margin.toFixed(1)} points` : code} onMouseEnter={() => setHovered(code)} onMouseLeave={() => setHovered("")} onFocus={() => setHovered(code)} onBlur={() => setHovered("")} onClick={() => openRace(code)} onKeyDown={(event) => { if (event.key === "Enter") openRace(code); }} />;
          })}
        </svg>}
        <div className="map-readout" aria-live="polite">{hoveredRace ? <><strong>{hoveredRace.code}</strong><span className={hoveredRace.leader === "D" ? "dem-text" : "rep-text"}>{hoveredRace.leader}+{hoveredRace.margin.toFixed(1)}</span><small>{hoveredRace.rating} · {hoveredRace.winProbability}% win probability</small></> : <><strong>Hover or select a district</strong><small>Click a modeled district to open its full race profile.</small></>}</div>
        <p className="chart-note">Boundaries: U.S. Census Bureau 2024 Cartographic Boundary Files for the 119th Congress. Forecast: Midterm Pulse experimental model; benchmark data from Vote-Scope.</p>
      </article>
      <aside className="panel district-rankings">
        <div className="panel-head"><div><p className="eyebrow">COMPETITIVENESS</p><h2>Races in view</h2></div><span className="panel-tag">sorted by margin</span></div>
        <div className="district-race-list">
          {races.slice(0, 36).map((race) => <Link key={race.code} href={`/races/${race.code.toLowerCase()}`} onMouseEnter={() => setHovered(race.code)} onMouseLeave={() => setHovered("")}><span><strong>{race.code}</strong><small>{race.rating}</small></span><b className={race.leader === "D" ? "dem-text" : "rep-text"}>{race.leader}+{race.margin.toFixed(1)}</b><em>{race.winProbability}%</em></Link>)}
          {races.length === 0 && <p className="table-empty">No districts match these filters.</p>}
        </div>
        {races.length > 36 && <Link className="text-button" href={`/races${stateCode === "US" ? "" : `?state=${stateCode}`}`}>See all {races.length} races →</Link>}
      </aside>
    </section>
  </>;
}
