import { marginColor, stateTiles } from "@/data/states";

export function StateTileMap({ values, label }: { values: Record<string, number>; label: string }) {
  return (
    <div className="tile-map-wrap">
      <div className="tile-map" role="img" aria-label={label}>
        {stateTiles.map((state) => {
          const value = values[state.code];
          const lead = value === undefined ? "No data" : `${value >= 0 ? "D" : "R"}+${Math.abs(value).toFixed(1)}`;
          return (
            <span
              className="state-tile"
              key={state.code}
              style={{ gridColumn: state.col + 1, gridRow: state.row + 1, background: marginColor(value) }}
              title={`${state.name}: ${lead}`}
            >{state.code}</span>
          );
        })}
      </div>
      <div className="map-legend"><span>Strong R</span><i className="legend-gradient" /><span>Strong D</span></div>
    </div>
  );
}
