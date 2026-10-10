"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/i18n/locale-provider";
import { ChartTooltip } from "@/components/motion/chart-tooltip";
import { stateByCode } from "@/data/geography";
import { marginColor } from "@/data/states";
import { loadMapGeometry, MAP_HEIGHT, MAP_WIDTH, type MapGeometry } from "@/lib/playground/geo";

// Too small to click on a national map: listed beside it, as election-night maps do.
const SMALL = ["VT", "NH", "MA", "RI", "CT", "NJ", "DE", "MD"];

/*
  The 50 states on their real outlines, coloured on the same D+/R+ scale as the tile map. Hover or focus
  shows a card; click (or Enter) selects. Small Northeastern states get clickable chips at the side.
*/
export function StateGeoMap({ values, label, onSelect, note }: { values: Record<string, number>; label: string; onSelect: (code: string) => void; note?: (code: string) => string | undefined }) {
  const t = useT();
  const [geometry, setGeometry] = useState<MapGeometry | null>(null);
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => { let alive = true; loadMapGeometry().then((data) => { if (alive) setGeometry(data); }).catch(() => undefined); return () => { alive = false; }; }, []);

  const shape = active ? geometry?.states.find((item) => item.code === active) : undefined;
  const value = active ? values[active] : undefined;
  const lead = (margin: number | undefined) => margin === undefined ? t("No data") : `${margin >= 0 ? "D" : "R"}+${Math.abs(margin).toFixed(1)}`;
  const name = (code: string) => t(stateByCode.get(code)?.name || code);

  if (!geometry) return <div className="map-loading">{t("Loading map…")}</div>;
  return <div className="state-geo-map">
    <div className="state-geo-frame">
      <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="group" aria-label={label} onPointerLeave={() => setActive(null)}>
        {geometry.states.map((item) => <path key={item.code} d={item.d} className={`state-geo${active === item.code ? " active" : ""}${active && active !== item.code ? " dim" : ""}`} style={{ fill: marginColor(values[item.code]) }}
          tabIndex={0} role="link" aria-label={`${name(item.code)}: ${lead(values[item.code])}`}
          onPointerEnter={() => setActive(item.code)} onFocus={() => setActive(item.code)} onBlur={() => setActive(null)}
          onClick={() => onSelect(item.code)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(item.code); } }} />)}
        {geometry.states.map((item) => item.outline ? <path key={`o-${item.code}`} d={item.outline} className="state-geo-line" aria-hidden="true" /> : null)}
        {shape?.outline && <path d={shape.outline} className="state-geo-highlight" aria-hidden="true" />}
      </svg>
      {shape && <ChartTooltip x={shape.centroid[0] / MAP_WIDTH * 100} y={shape.centroid[1] / MAP_HEIGHT * 100 - 4} title={name(shape.code)}
        rows={[{ label: t("Margin"), value: lead(value), tone: value === undefined ? "muted" : value >= 0 ? "dem" : "rep" }]}
        note={note?.(shape.code) ?? t("Click to open")} />}
    </div>
    <div className="state-geo-small" aria-label={t("Small states")}>
      {SMALL.map((code) => <button key={code} type="button" className={active === code ? "active" : ""} onPointerEnter={() => setActive(code)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(code)} onBlur={() => setActive(null)} onClick={() => onSelect(code)}>
        <i style={{ background: marginColor(values[code]) }} /><b>{code}</b><span>{lead(values[code])}</span>
      </button>)}
    </div>
  </div>;
}
