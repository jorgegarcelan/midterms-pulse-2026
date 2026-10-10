"use client";

import "@/app/motion-b.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/components/i18n/locale-provider";
import { fitViewBox, useViewBoxTween, type ViewBox } from "@/components/motion/map-viewbox";
import { stateByCode } from "@/data/geography";
import type { ForecastRace } from "@/lib/forecast";
import { loadMapGeometry, MAP_HEIGHT, MAP_WIDTH, type MapGeometry } from "@/lib/playground/geo";

type Bounds = [[number, number], [number, number]];
const NATIONAL: ViewBox = [0, 0, MAP_WIDTH, MAP_HEIGHT];

export function raceFill(race?: ForecastRace) {
  if (!race) return "#1c1f27";
  const intensity = Math.min(1, Math.abs(race.signedMargin) / 18);
  return race.leader === "D"
    ? `color-mix(in srgb, #5b86ff ${Math.round(35 + intensity * 55)}%, #141722)`
    : `color-mix(in srgb, #ff5a6e ${Math.round(35 + intensity * 55)}%, #141722)`;
}

/*
  The races on a real map. House: every district; a click zooms into its state, a second click opens
  the race. Senate: every state, a click opens its race. Races outside the current filters are muted,
  and hovering (or focusing) a shape shows a floating card. Fully controlled by the parent.
*/
export function RaceMap({ chamber, races, matches, stateCode, hovered, onHover, onState, onOpen }: {
  chamber: "house" | "senate"; races: ForecastRace[]; matches: Set<string> | null; stateCode: string; hovered: string;
  onHover: (code: string) => void; onState: (code: string) => void; onOpen: (race: ForecastRace) => void;
}) {
  const t = useT();
  const [geometry, setGeometry] = useState<MapGeometry | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  useEffect(() => { let alive = true; loadMapGeometry().then((data) => { if (alive) setGeometry(data); }).catch(() => undefined); return () => { alive = false; }; }, []);

  const byCode = useMemo(() => new Map(races.filter((race) => race.chamber === chamber).map((race) => [race.code, race])), [chamber, races]);
  const stateBounds = useMemo(() => {
    const bounds = new Map<string, Bounds>();
    for (const shape of geometry?.districts ?? []) {
      // Approximate each district's box from its path's numbers: cheap and good enough for camera framing.
      const numbers = shape.d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let index = 0; index + 1 < numbers.length; index += 2) { x0 = Math.min(x0, numbers[index]); x1 = Math.max(x1, numbers[index]); y0 = Math.min(y0, numbers[index + 1]); y1 = Math.max(y1, numbers[index + 1]); }
      const known = bounds.get(shape.state);
      bounds.set(shape.state, known ? [[Math.min(known[0][0], x0), Math.min(known[0][1], y0)], [Math.max(known[1][0], x1), Math.max(known[1][1], y1)]] : [[x0, y0], [x1, y1]]);
    }
    return bounds;
  }, [geometry]);

  const zoomed = chamber === "house" && stateCode !== "US" && stateBounds.has(stateCode);
  const target = useMemo<ViewBox>(() => {
    const bounds = zoomed ? stateBounds.get(stateCode) : undefined;
    return bounds ? fitViewBox(bounds, [MAP_WIDTH, MAP_HEIGHT], .1, 40) : NATIONAL;
  }, [stateBounds, stateCode, zoomed]);
  const svgRef = useViewBoxTween(target, { ready: Boolean(geometry) });

  const shapes = chamber === "house" ? geometry?.districts ?? [] : geometry?.states ?? [];
  const hoveredRace = byCode.get(hovered);
  const hoveredPath = shapes.find((shape) => shape.code === hovered)?.d ?? "";

  function activate(code: string) {
    const race = byCode.get(code);
    if (chamber === "senate") { if (race) onOpen(race); else onState(code); return; }
    const state = code.slice(0, 2);
    if (state !== stateCode) { onHover(""); onState(state); return; }
    if (race) onOpen(race);
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
  const codeOf = (target: EventTarget) => (target instanceof SVGPathElement ? target.dataset.code : undefined) || "";
  // Lets the parent's list place the card on a shape it highlights.
  useEffect(() => {
    if (!hovered) return;
    const path = frame.current?.querySelector<SVGPathElement>(`path[data-code="${hovered}"]`);
    const box = frame.current?.getBoundingClientRect();
    if (!path || !box || frame.current?.matches(":hover")) return;
    const rect = path.getBoundingClientRect();
    placeTip(rect.left + rect.width / 2 - box.left, rect.top - box.top);
  }, [hovered]);

  const name = (code: string) => t(stateByCode.get(code)?.name || code);
  const label = (race: ForecastRace) => race.chamber === "senate" ? t("{state} Senate", { state: name(race.state) }) : race.code;

  if (!geometry) return <div className="map-loading">{t("Loading Census boundaries and model output…")}</div>;
  return <div className={`district-map-frame race-map${zoomed ? " zoomed" : ""}${matches ? " filtering" : ""}`} ref={frame}
    onKeyDown={(event) => { if (event.key === "Escape" && zoomed) { event.preventDefault(); onState("US"); } }}>
    <svg ref={svgRef} viewBox={NATIONAL.join(" ")} role="group"
      aria-label={chamber === "senate" ? t("Senate races by state") : stateCode === "US" ? t("Congressional districts for the United States") : t("Congressional districts for {state}", { state: stateCode })}
      onPointerMove={(event) => { const code = codeOf(event.target); if (code !== hovered) onHover(code); const box = frame.current?.getBoundingClientRect(); if (box) placeTip(event.clientX - box.left, event.clientY - box.top); }}
      onPointerLeave={() => onHover("")}
      onClick={(event) => { const code = codeOf(event.target); if (code) activate(code); }}
      onFocus={(event) => { const code = codeOf(event.target); if (code) onHover(code); }}
      onBlur={() => onHover("")}
      onKeyDown={(event) => { const code = codeOf(event.target); if (code && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); activate(code); } }}>
      {shapes.map((shape) => {
        const race = byCode.get(shape.code);
        const outside = zoomed && shape.state !== stateCode;
        const muted = matches !== null && !matches.has(shape.code);
        return <path key={shape.code} d={shape.d} data-code={shape.code}
          style={{ fill: raceFill(race), "--d": (shape.centroid[0] / MAP_WIDTH).toFixed(3) } as React.CSSProperties}
          className={`${outside ? "outside" : ""}${muted ? " muted" : ""}${chamber === "senate" && !race ? " no-race" : ""}`}
          tabIndex={(race || chamber === "senate") && !outside ? 0 : -1} role={race ? "link" : undefined}
          aria-label={race ? t("{code}, {party} leads by {margin} points", { code: label(race), party: race.leader, margin: race.margin.toFixed(1) }) : chamber === "senate" ? t("{state}: no Senate race in 2026", { state: name(shape.code) }) : shape.code} />;
      })}
      {chamber === "house" && geometry.states.map((shape) => shape.outline ? <path key={`outline-${shape.code}`} d={shape.outline} className="race-map-state-line" aria-hidden="true" /> : null)}
      {hoveredPath && <path className="district-hover-outline" d={hoveredPath} aria-hidden="true" />}
    </svg>
    {zoomed && <button type="button" className="map-zoom-out" onClick={() => onState("US")}><span aria-hidden="true">←</span> {t("All states")}<kbd>Esc</kbd></button>}
    {zoomed && <div className="map-zoom-label" key={stateCode}><b>{name(stateCode)}</b><span>{t("{count} districts", { count: geometry.districts.filter((shape) => shape.state === stateCode).length })}</span></div>}
    <div className={`map-float-tip${hoveredRace || (chamber === "senate" && hovered) ? " show" : ""}`} ref={tip} aria-hidden="true">
      {hoveredRace ? <>
        <div className="map-float-tip-head"><strong>{label(hoveredRace)}</strong><b className={hoveredRace.leader === "D" ? "dem-text" : "rep-text"}>{hoveredRace.leader}+{hoveredRace.margin.toFixed(1)}</b></div>
        <span className="map-float-tip-bar"><i className="dem" style={{ width: `${hoveredRace.demVote || 50}%` }} /><i className="rep" style={{ width: `${hoveredRace.repVote || 50}%` }} /></span>
        <small>{t(hoveredRace.rating)} · {t("{probability}% win probability", { probability: hoveredRace.winProbability })}</small>
        <em>{chamber === "senate" || hoveredRace.state === stateCode ? t("Click to open the race →") : t("Click to zoom into {state}", { state: name(hoveredRace.state) })}</em>
      </> : chamber === "senate" && hovered ? <><div className="map-float-tip-head"><strong>{name(hovered)}</strong></div><small>{t("No Senate race in 2026")}</small><em>{t("Click to open the state →")}</em></> : null}
    </div>
  </div>;
}
