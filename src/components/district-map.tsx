"use client";

import "@/app/motion-b.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/i18n/link";
import { useRouter } from "next/navigation";
import { useLocalePath, useT } from "@/components/i18n/locale-provider";
import { geoAlbersUsa, geoPath } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";
import { useElectionContext } from "@/components/election-context";
import { stateByCode, stateCodeByFips } from "@/data/geography";
import type { ForecastRace } from "@/lib/forecast";
import { ShareImageButton } from "@/components/share-image-button";
import { CountUp } from "@/components/motion/count-up";
import { fitViewBox, useViewBoxTween, type ViewBox } from "@/components/motion/map-viewbox";
import { useFlipList } from "@/components/motion/race-tween";

type DistrictProperties = { GEOID: string; STATEFP: string; CD119FP: string; NAMELSAD: string };
type DistrictCollection = FeatureCollection<Geometry, DistrictProperties> & { source?: string };
type ModelFeed = { races: ForecastRace[]; runDate: string; version: string };
type Bounds = [[number, number], [number, number]];

const FRAME: [number, number] = [960, 570];
const NATIONAL: ViewBox = [0, 0, FRAME[0], FRAME[1]];

function districtCode(feature: DistrictCollection["features"][number]) {
  return `${stateCodeByFips.get(feature.properties.STATEFP) || ""}-${feature.properties.CD119FP}`;
}

function fill(race?: ForecastRace) {
  if (!race) return "#1c1f27";
  const intensity = Math.min(1, Math.abs(race.signedMargin) / 18);
  if (race.leader === "D") return `color-mix(in srgb, #5b86ff ${Math.round(35 + intensity * 55)}%, #141722)`;
  return `color-mix(in srgb, #ff5a6e ${Math.round(35 + intensity * 55)}%, #141722)`;
}

export function DistrictMap() {
  const router = useRouter();
  const localize = useLocalePath();
  const t = useT();
  const { stateCode, setContext } = useElectionContext();
  const [geography, setGeography] = useState<DistrictCollection | null>(null);
  const [model, setModel] = useState<ModelFeed | null>(null);
  const [hovered, setHovered] = useState("");
  const [search, setSearch] = useState("");
  const [competitiveOnly, setCompetitiveOnly] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/data/congressional-districts-119.geojson", { signal: controller.signal }).then((response) => response.json() as Promise<DistrictCollection>),
      fetch("/api/model", { signal: controller.signal }).then((response) => response.json() as Promise<ModelFeed>),
    ]).then(([geo, nextModel]) => { setGeography(geo); setModel(nextModel); }).catch(() => undefined);
    return () => controller.abort();
  }, []);

  const raceByCode = useMemo(() => new Map((model?.races || []).filter((race) => race.chamber === "house").map((race) => [race.code, race])), [model]);

  // One national projection for every district; zooming into a state moves the camera (viewBox), not the geometry.
  const projected = useMemo(() => {
    if (!geography) return { paths: [], states: new Map<string, Bounds>() };
    const features = geography.features.filter((feature) => Number(feature.properties.STATEFP) <= 56 && feature.properties.CD119FP !== "98");
    const collection: FeatureCollection<Geometry, DistrictProperties> = { type: "FeatureCollection", features };
    const projection = geoAlbersUsa().fitExtent([[18, 18], [FRAME[0] - 18, FRAME[1] - 18]], collection);
    const draw = geoPath(projection);
    const states = new Map<string, Bounds>();
    const paths = features.map((feature) => {
      const code = districtCode(feature);
      const state = code.slice(0, 2);
      const bounds = draw.bounds(feature) as Bounds;
      const known = states.get(state);
      states.set(state, known ? [[Math.min(known[0][0], bounds[0][0]), Math.min(known[0][1], bounds[0][1])], [Math.max(known[1][0], bounds[1][0]), Math.max(known[1][1], bounds[1][1])]] : bounds);
      return { key: feature.properties.GEOID, code, state, path: draw(feature) || "", sweep: Number.isFinite(bounds[0][0]) ? (bounds[0][0] + bounds[1][0]) / 2 / FRAME[0] : 0 };
    });
    return { paths, states };
  }, [geography]);

  const zoomed = stateCode !== "US" && projected.states.has(stateCode);
  const target = useMemo<ViewBox>(() => {
    const bounds = zoomed ? projected.states.get(stateCode) : undefined;
    return bounds ? fitViewBox(bounds, FRAME, .1, 40) : NATIONAL;
  }, [projected, stateCode, zoomed]);
  const svgRef = useViewBoxTween(target, { ready: Boolean(geography && model) });

  const races = useMemo(() => (model?.races || [])
    .filter((race) => race.chamber === "house" && (stateCode === "US" || race.state === stateCode))
    .filter((race) => !competitiveOnly || race.margin <= 5)
    .filter((race) => !search || `${race.code} ${race.rating} ${t(race.rating)}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.margin - b.margin), [competitiveOnly, model, search, stateCode, t]);
  const filtering = Boolean(search) || competitiveOnly;
  const matches = useMemo(() => new Set(races.map((race) => race.code)), [races]);
  const hoveredRace = raceByCode.get(hovered);
  const hoveredPath = useMemo(() => projected.paths.find((item) => item.code === hovered)?.path || "", [hovered, projected]);
  const listRef = useFlipList<HTMLDivElement>(races.slice(0, 36).map((race) => race.code).join());

  function openRace(code: string) {
    const race = raceByCode.get(code);
    if (!race) return;
    setContext({ stateCode: race.state, chamber: "house" });
    router.push(localize(`/races/${code.toLowerCase()}`));
  }

  // National view: a click zooms into the district's state. Inside a state: a click opens the race.
  function activate(code: string) {
    const state = code.slice(0, 2);
    if (state !== stateCode) { setHovered(""); setContext({ stateCode: state }); return; }
    openRace(code);
  }

  function placeTip(x: number, y: number) {
    const element = tip.current;
    const box = frame.current?.getBoundingClientRect();
    if (!element || !box) return;
    const width = element.offsetWidth || 220;
    const left = Math.max(8, Math.min(box.width - width - 8, x - width / 2));
    const flip = y < (element.offsetHeight || 110) + 24;
    element.style.transform = `translate3d(${left.toFixed(0)}px, ${(flip ? y + 22 : y - 14).toFixed(0)}px, 0) translateY(${flip ? "0" : "-100%"})`;
  }
  function placeTipAt(code: string) {
    const path = frame.current?.querySelector<SVGPathElement>(`path[data-code="${code}"]`);
    const box = frame.current?.getBoundingClientRect();
    if (!path || !box) return;
    const rect = path.getBoundingClientRect();
    placeTip(rect.left + rect.width / 2 - box.left, rect.top - box.top);
  }
  const codeOf = (target: EventTarget) => (target instanceof SVGPathElement ? target.dataset.code : undefined) || "";

  function pointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const code = codeOf(event.target);
    if (code !== hovered) setHovered(code);
    const box = frame.current?.getBoundingClientRect();
    if (box) placeTip(event.clientX - box.left, event.clientY - box.top);
  }

  const stateName = zoomed ? t(stateByCode.get(stateCode)?.name || stateCode) : "";

  return <>
    <section className="page-intro district-intro">
      <div><p className="eyebrow">{t("119TH CONGRESS · 435 VOTING DISTRICTS")}</p><h1>{t("Congressional district map")}</h1><p>{t("Inspect every House district, isolate a state and move directly into the underlying race profile. Color shows the current Midterm Pulse model lean; gray means no modeled match.")}</p><ShareImageButton label={stateCode === "US" ? t("Download map") : t("Download {state} image", { state: stateCode })} href={stateCode === "US" ? "/api/share/map" : `/api/share/state/${stateCode.toLowerCase()}`} /></div>
      <div className="stat-stamp"><strong><CountUp value={races.length} /></strong><span>{stateCode === "US" ? t("districts in view") : t("{state} districts", { state: stateCode })}</span><small>{model?.runDate || t("Loading model…")}</small></div>
    </section>
    <section className="district-toolbar" aria-label={t("District map controls")}>
      <label>{t("Find a district")}<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("AZ-01 or Toss Up")} /></label>
      <label className="check-control"><input type="checkbox" checked={competitiveOnly} onChange={(event) => setCompetitiveOnly(event.target.checked)} /> {t("Competitive only (≤5 pts)")}</label>
      <div className="district-legend"><span><i className="dem" /> {t("Democratic lead")}</span><span><i className="neutral" /> {t("Unmatched")}</span><span><i className="rep" /> {t("Republican lead")}</span></div>
    </section>
    <section className="district-layout">
      <article className="panel district-map-panel">
        {!geography || !model ? <div className="map-loading">{t("Loading Census boundaries and model output…")}</div> : <div
          className={`district-map-frame${zoomed ? " zoomed" : ""}${filtering ? " filtering" : ""}`}
          ref={frame}
          onKeyDown={(event) => { if (event.key === "Escape" && zoomed) { event.preventDefault(); setContext({ stateCode: "US" }); } }}
        >
          <svg
            ref={svgRef}
            viewBox={NATIONAL.join(" ")}
            role="group"
            aria-label={stateCode === "US" ? t("Congressional districts for the United States") : t("Congressional districts for {state}", { state: stateCode })}
            onPointerMove={pointerMove}
            onPointerLeave={() => setHovered("")}
            onClick={(event) => { const code = codeOf(event.target); if (code) activate(code); }}
            onFocus={(event) => { const code = codeOf(event.target); if (code) { setHovered(code); requestAnimationFrame(() => placeTipAt(code)); } }}
            onBlur={() => setHovered("")}
            onKeyDown={(event) => { const code = codeOf(event.target); if (code && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); activate(code); } }}
          >
            {projected.paths.map(({ key, code, state, path, sweep }) => {
              const race = raceByCode.get(code);
              const outside = zoomed && state !== stateCode;
              const muted = filtering && !matches.has(code);
              return <path
                key={key}
                d={path}
                data-code={code}
                style={{ fill: fill(race), "--d": sweep.toFixed(3) } as React.CSSProperties}
                className={`${outside ? "outside" : ""}${muted ? " muted" : ""}`}
                tabIndex={race && !outside ? 0 : -1}
                role={race ? "link" : undefined}
                aria-label={race ? t("{code}, {party} leads by {margin} points", { code, party: race.leader, margin: race.margin.toFixed(1) }) : code}
              />;
            })}
            {hoveredPath && <path className="district-hover-outline" d={hoveredPath} aria-hidden="true" />}
          </svg>
          {zoomed && <button type="button" className="map-zoom-out" onClick={() => setContext({ stateCode: "US" })}><span aria-hidden="true">←</span> {t("All states")}<kbd>Esc</kbd></button>}
          {zoomed && <div className="map-zoom-label" key={stateCode}><b>{stateName}</b><span>{t("{count} districts", { count: projected.paths.filter((item) => item.state === stateCode).length })}</span></div>}
          <div className={`map-float-tip${hoveredRace ? " show" : ""}`} ref={tip} aria-hidden="true">
            {hoveredRace && <>
              <div className="map-float-tip-head"><strong>{hoveredRace.code}</strong><b className={hoveredRace.leader === "D" ? "dem-text" : "rep-text"}>{hoveredRace.leader}+{hoveredRace.margin.toFixed(1)}</b></div>
              <span className="map-float-tip-bar"><i className="dem" style={{ width: `${hoveredRace.demVote || 50}%` }} /><i className="rep" style={{ width: `${hoveredRace.repVote || 50}%` }} /></span>
              <small>{t(hoveredRace.rating)} · {t("{probability}% win probability", { probability: hoveredRace.winProbability })}</small>
              <em>{hoveredRace.state === stateCode ? t("Click to open the race →") : t("Click to zoom into {state}", { state: t(stateByCode.get(hoveredRace.state)?.name || hoveredRace.state) })}</em>
            </>}
          </div>
        </div>}
        <div className="map-readout" aria-live="polite">{hoveredRace ? <><strong>{hoveredRace.code}</strong><span className={hoveredRace.leader === "D" ? "dem-text" : "rep-text"}>{hoveredRace.leader}+{hoveredRace.margin.toFixed(1)}</span><small>{t(hoveredRace.rating)} · {t("{probability}% win probability", { probability: hoveredRace.winProbability })}</small></> : <><strong>{t("Hover or select a district")}</strong><small>{zoomed ? t("Click a modeled district to open its full race profile.") : t("Click a district to zoom into its state; click again to open the race.")}</small></>}</div>
        <p className="chart-note">{t("Boundaries: U.S. Census Bureau 2024 Cartographic Boundary Files for the 119th Congress. Forecast: Midterm Pulse experimental model; benchmark data from Vote-Scope.")}</p>
      </article>
      <aside className="panel district-rankings">
        <div className="panel-head"><div><p className="eyebrow">{t("COMPETITIVENESS")}</p><h2>{t("Races in view")}</h2></div><span className="panel-tag">{t("sorted by margin")}</span></div>
        <div className="district-race-list" ref={listRef}>
          {races.slice(0, 36).map((race) => <Link key={race.code} data-flip={race.code} className={hovered === race.code ? "linked" : undefined} href={`/races/${race.code.toLowerCase()}`} onMouseEnter={() => { setHovered(race.code); requestAnimationFrame(() => placeTipAt(race.code)); }} onMouseLeave={() => setHovered("")}><span><strong>{race.code}</strong><small>{t(race.rating)}</small></span><b className={race.leader === "D" ? "dem-text" : "rep-text"}>{race.leader}+{race.margin.toFixed(1)}</b><em>{race.winProbability}%</em></Link>)}
          {races.length === 0 && <p className="table-empty">{t("No districts match these filters.")}</p>}
        </div>
        {races.length > 36 && <Link className="text-button" href={`/races${stateCode === "US" ? "" : `?state=${stateCode}`}`}>{t("See all {count} races →", { count: races.length })}</Link>}
      </aside>
    </section>
  </>;
}
