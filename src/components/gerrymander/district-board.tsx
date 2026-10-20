"use client";

import { forwardRef, useMemo } from "react";
import { useT } from "@/components/i18n/locale-provider";
import { CELLS, EDGES, SIZE, VOTERS, colOf, rowOf, tally, wastedCells, type Party } from "@/lib/gerrymander";

const S = 100;
const PAD = 8;

export const DISTRICT_HUES = ["#a78bfa", "#2dd4bf", "#fbbf24", "#a3e635", "#e2e8f0"];
const PARTY_TINT: Record<Party, string> = { B: "rgba(91,134,255,.24)", R: "rgba(255,90,110,.24)" };
const EMPTY = "rgba(255,255,255,.025)";

export type BoardLabel = "packed" | "cracked";

type Props = {
  assign: number[];
  fill?: "party" | "district";
  wasted?: boolean;
  highlight?: number[] | null;
  labels?: Partial<Record<number, BoardLabel>>;
  badges?: boolean;
  className?: string;
  ariaLabel: string;
} & Omit<React.SVGProps<SVGSVGElement>, "ref">;

/*
  The 5×5 board. Every internal edge is always rendered and only its opacity changes, so switching maps
  reads as borders dissolving and redrawing rather than a hard cut. Cell tints transition the same way.
*/
export const DistrictBoard = forwardRef<SVGSVGElement, Props>(function DistrictBoard(
  { assign, fill = "party", wasted = false, highlight = null, labels, badges = false, className = "", ariaLabel, ...rest }, ref,
) {
  const t = useT();
  const result = useMemo(() => tally(assign), [assign]);
  const wastedSet = useMemo(() => (wasted ? wastedCells(assign) : new Set<number>()), [assign, wasted]);
  const anchors = useMemo(() => result.districts.map((district) => Math.min(...district.cells, CELLS)), [result]);

  const tint = (cell: number) => {
    const district = assign[cell];
    if (district < 0) return EMPTY;
    if (fill === "district") return `color-mix(in srgb, ${DISTRICT_HUES[district]} 34%, transparent)`;
    const winner = result.districts[district].winner;
    return winner ? PARTY_TINT[winner] : EMPTY;
  };

  return (
    <svg ref={ref} viewBox={`${-PAD} ${-PAD} ${SIZE * S + PAD * 2} ${SIZE * S + PAD * 2}`} className={`gm-board ${className}`} role="img" aria-label={ariaLabel} {...rest}>
      <rect className="gm-frame" x={0} y={0} width={SIZE * S} height={SIZE * S} rx={18} />
      {Array.from({ length: CELLS }, (_, cell) => {
        const district = assign[cell];
        const dim = highlight && district >= 0 && !highlight.includes(district);
        return (
          <g key={cell} className={`gm-cell-g${dim ? " dim" : ""}`} data-cell={cell}>
            <rect className="gm-cell" x={colOf(cell) * S + 5} y={rowOf(cell) * S + 5} width={S - 10} height={S - 10} rx={14} style={{ fill: tint(cell), transitionDelay: `${(district < 0 ? 0 : district) * 60}ms` }} />
            <circle
              className={`gm-voter ${VOTERS[cell] === "B" ? "blue" : "red"}${wastedSet.has(cell) ? " wasted" : ""}`}
              cx={colOf(cell) * S + S / 2}
              cy={rowOf(cell) * S + S / 2}
              r={19}
              style={{ "--i": cell } as React.CSSProperties}
            />
          </g>
        );
      })}
      <g className="gm-edges" aria-hidden="true">
        {EDGES.map(({ a, b, vertical }) => {
          const on = assign[a] !== assign[b] && (assign[a] >= 0 || assign[b] >= 0);
          const x = vertical ? (colOf(a) + 1) * S : colOf(a) * S;
          const y = vertical ? rowOf(a) * S : (rowOf(a) + 1) * S;
          return <line key={`${a}-${b}`} className={on ? "on" : ""} x1={x} y1={y} x2={vertical ? x : x + S} y2={vertical ? y + S : y} />;
        })}
        <rect className="gm-outline" x={0} y={0} width={SIZE * S} height={SIZE * S} rx={18} />
      </g>
      {labels && result.districts.map((district) => {
        const label = labels[district.id];
        if (!label || anchors[district.id] >= CELLS) return null;
        const cell = anchors[district.id];
        const text = label === "packed" ? t("PACKED") : t("CRACKED");
        return (
          <g key={`label-${district.id}`} className={`gm-tag ${label}`} transform={`translate(${colOf(cell) * S + 10} ${rowOf(cell) * S + 10})`}>
            <rect width={text.length * 6.9 + 12} height={19} rx={6} />
            <text x={6} y={13.5}>{text}</text>
          </g>
        );
      })}
      {badges && result.districts.map((district) => {
        if (!district.winner) return null;
        const cell = anchors[district.id];
        return <circle key={`badge-${district.id}-${district.winner}`} className={`gm-badge ${district.winner === "B" ? "blue" : "red"}`} cx={colOf(cell) * S + 17} cy={rowOf(cell) * S + 17} r={7} />;
      })}
    </svg>
  );
});
