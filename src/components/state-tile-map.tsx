"use client";

import { useState } from "react";
import { useT } from "@/components/i18n/locale-provider";
import { useInView } from "@/components/explainer/use-in-view";
import { ChartTooltip } from "@/components/motion/chart-tooltip";
import { marginColor, stateTiles } from "@/data/states";

const COLS = 14;
const ROWS = 7;
const LEGEND_RANGE = 15;

function strength(value: number) {
  const size = Math.abs(value);
  return size < 1 ? "Toss-up" : size <= 8 ? (value > 0 ? "Lean D" : "Lean R") : (value > 0 ? "Strong D" : "Strong R");
}

// Tiles sweep in diagonally when the map scrolls into view; hovering or focusing a state lifts it,
// dims the rest, shows its margin and drops a marker on the colour legend.
export function StateTileMap({ values, label }: { values: Record<string, number>; label: string }) {
  const t = useT();
  const [ref, inView] = useInView<HTMLDivElement>();
  const [active, setActive] = useState<string | null>(null);
  const tile = active ? stateTiles.find((state) => state.code === active) : undefined;
  const value = active ? values[active] : undefined;
  const lead = (margin: number | undefined) => margin === undefined ? t("No data") : `${margin >= 0 ? "D" : "R"}+${Math.abs(margin).toFixed(1)}`;

  return (
    <div className="tile-map-wrap">
      <div className="mpa-map-frame">
        <div ref={ref} className="tile-map mpa-tile-map" role="group" aria-label={label} data-in={inView ? "true" : undefined} data-active={active ? "true" : undefined} onPointerLeave={() => setActive(null)}>
          {stateTiles.map((state) => {
            const margin = values[state.code];
            return (
              <span
                className={`state-tile${active === state.code ? " active" : ""}`}
                key={state.code}
                style={{ gridColumn: state.col + 1, gridRow: state.row + 1, background: marginColor(margin), "--d": state.col + state.row } as React.CSSProperties}
                data-empty={margin === undefined ? "true" : undefined}
                tabIndex={margin === undefined ? undefined : 0}
                aria-label={`${t(state.name)}: ${lead(margin)}`}
                onPointerEnter={() => setActive(state.code)}
                onFocus={() => setActive(state.code)}
                onBlur={() => setActive(null)}
              >{state.code}</span>
            );
          })}
        </div>
        {tile && <ChartTooltip
          x={(tile.col + .5) / COLS * 100}
          y={tile.row / ROWS * 100}
          title={t(tile.name)}
          rows={[{ label: t("Margin"), value: lead(value), tone: value === undefined ? "muted" : value >= 0 ? "dem" : "rep" }]}
          note={value === undefined ? t("No current benchmark") : t(strength(value))}
        />}
      </div>
      <div className="map-legend"><span>{t("Strong R")}</span><i className="legend-gradient mpa-legend">{value !== undefined && <b style={{ left: `${(Math.max(-LEGEND_RANGE, Math.min(LEGEND_RANGE, value)) + LEGEND_RANGE) / (LEGEND_RANGE * 2) * 100}%` }} />}</i><span>{t("Strong D")}</span></div>
    </div>
  );
}
