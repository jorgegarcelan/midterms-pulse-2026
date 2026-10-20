"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/components/i18n/locale-provider";
import { fitViewBox, useViewBoxTween, type ViewBox } from "@/components/motion/map-viewbox";
import { stateByCode } from "@/data/geography";
import { loadMapGeometry, MAP_HEIGHT, MAP_WIDTH, type MapGeometry, type MapLines } from "@/lib/playground/geo";

const NATIONAL: ViewBox = [0, 0, MAP_WIDTH, MAP_HEIGHT];
const NEUTRAL = "#2b2f3a";

// Diverging fill: blue for Democratic, red for Republican, a neutral grey at zero; `cap` is the full-colour value.
export function divergingFill(value: number | null | undefined, cap = 30) {
  if (value === null || value === undefined || Number.isNaN(value)) return "#15171e";
  const intensity = Math.min(1, Math.abs(value) / cap);
  const hue = value >= 0 ? "#5b86ff" : "#ff5a6e";
  return `color-mix(in srgb, ${hue} ${Math.round(12 + intensity * 80)}%, ${NEUTRAL})`;
}

export function DivergingLegend({ left, right, cap, unit = "", missing }: { left: string; right: string; cap: number; unit?: string; missing?: string }) {
  return (
    <div className="cz-map-legend" aria-hidden="true">
      <span>{left}</span>
      <i style={{ background: `linear-gradient(90deg, ${divergingFill(-cap, cap)}, ${divergingFill(-cap / 2, cap)}, ${NEUTRAL}, ${divergingFill(cap / 2, cap)}, ${divergingFill(cap, cap)})` }} />
      <span>{right}</span>
      <small>{`±${cap}${unit}`}</small>
      {missing && <span className="cz-map-missing"><i />{missing}</span>}
    </div>
  );
}

/*
  A district map for the census page: national view, a click zooms into a state and a second click
  selects the district. Colours and the hover card come from the parent, so one component serves
  the 2026 forecast, the census-vs-polls map and the 2024 residuals.
*/
export function CensusMap({ lines, fill, tip, label, selected, onSelect }: {
  lines: MapLines; fill: (code: string) => string; tip: (code: string) => React.ReactNode; label: string;
  selected?: string; onSelect?: (code: string) => void;
}) {
  const t = useT();
  const [geometry, setGeometry] = useState<MapGeometry | null>(null);
  const [state, setState] = useState("US");
  const [hovered, setHovered] = useState("");
  const frame = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => { let alive = true; loadMapGeometry(lines).then((data) => { if (alive) setGeometry(data); }).catch(() => undefined); return () => { alive = false; }; }, [lines]);

  const bounds = useMemo(() => {
    const out = new Map<string, [[number, number], [number, number]]>();
    for (const shape of geometry?.districts ?? []) {
      const numbers = shape.d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i + 1 < numbers.length; i += 2) { x0 = Math.min(x0, numbers[i]); x1 = Math.max(x1, numbers[i]); y0 = Math.min(y0, numbers[i + 1]); y1 = Math.max(y1, numbers[i + 1]); }
      const known = out.get(shape.state);
      out.set(shape.state, known ? [[Math.min(known[0][0], x0), Math.min(known[0][1], y0)], [Math.max(known[1][0], x1), Math.max(known[1][1], y1)]] : [[x0, y0], [x1, y1]]);
    }
    return out;
  }, [geometry]);
  const zoomed = state !== "US" && bounds.has(state);
  const target = useMemo<ViewBox>(() => zoomed ? fitViewBox(bounds.get(state)!, [MAP_WIDTH, MAP_HEIGHT], .1, 40) : NATIONAL, [bounds, state, zoomed]);
  const svgRef = useViewBoxTween(target, { ready: Boolean(geometry) });

  function place(clientX: number, clientY: number) {
    const box = frame.current?.getBoundingClientRect();
    const element = card.current;
    if (!box || !element) return;
    const x = clientX - box.left, y = clientY - box.top;
    const width = element.offsetWidth || 200;
    const left = Math.max(8, Math.min(box.width - width - 8, x - width / 2));
    const flip = y < (element.offsetHeight || 90) + 24;
    element.style.transform = `translate3d(${left.toFixed(0)}px, ${(flip ? y + 20 : y - 14).toFixed(0)}px, 0) translateY(${flip ? "0" : "-100%"})`;
  }
  const codeOf = (target: EventTarget) => (target instanceof SVGPathElement ? target.dataset.code : undefined) || "";
  function activate(code: string) {
    if (code.slice(0, 2) !== state) { setState(code.slice(0, 2)); setHovered(""); return; }
    onSelect?.(code);
  }

  if (!geometry) return <div className="cz-map-loading">{t("Loading district boundaries…")}</div>;
  const hoveredPath = geometry.districts.find((shape) => shape.code === hovered)?.d;
  const selectedPath = selected ? geometry.districts.find((shape) => shape.code === selected)?.d : undefined;
  return (
    <div className={`cz-map${zoomed ? " zoomed" : ""}`} ref={frame} onKeyDown={(event) => { if (event.key === "Escape" && zoomed) setState("US"); }}>
      <svg ref={svgRef} viewBox={NATIONAL.join(" ")} role="group" aria-label={label}
        onPointerMove={(event) => { const code = codeOf(event.target); if (code !== hovered) setHovered(code); place(event.clientX, event.clientY); }}
        onPointerLeave={() => setHovered("")}
        onClick={(event) => { const code = codeOf(event.target); if (code) activate(code); }}
        onKeyDown={(event) => { const code = codeOf(event.target); if (code && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); activate(code); } }}>
        {geometry.districts.map((shape) => (
          <path key={shape.code} d={shape.d} data-code={shape.code} style={{ fill: fill(shape.code) }} tabIndex={zoomed && shape.state !== state ? -1 : 0}
            className={zoomed && shape.state !== state ? "outside" : undefined} aria-label={shape.code} />
        ))}
        {geometry.states.map((shape) => shape.outline ? <path key={`s-${shape.code}`} d={shape.outline} className="cz-map-state" aria-hidden="true" /> : null)}
        {selectedPath && <path d={selectedPath} className="cz-map-selected" aria-hidden="true" />}
        {hoveredPath && <path d={hoveredPath} className="cz-map-hover" aria-hidden="true" />}
      </svg>
      {zoomed
        ? <button type="button" className="cz-map-back" onClick={() => setState("US")}><span aria-hidden="true">←</span> {t("All states")}</button>
        : <p className="cz-map-hint">{t("Click a state to zoom in, then a district for its profile.")}</p>}
      {zoomed && <p className="cz-map-state-name">{t(stateByCode.get(state)?.name || state)}</p>}
      <div className={`cz-map-tip${hovered ? " show" : ""}`} ref={card} aria-hidden="true">
        {hovered && <><b>{hovered}</b>{tip(hovered)}</>}
      </div>
    </div>
  );
}
