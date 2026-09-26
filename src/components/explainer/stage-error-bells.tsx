"use client";

import { useEffect, useMemo, useState } from "react";
import { demWinProbability, inverseNormal, RACE_COMMON_SD, RACE_LOCAL_SD, RACE_SD } from "@/lib/mp26";
import { signedLabel, useInView } from "@/components/explainer/use-in-view";
import type { ExplainerRace } from "@/components/explainer/stage-race-curve";

const VW = 640;
const ROW = 92;
const PAD = { left: 110, right: 18 };
const RANGE: [number, number] = [-32, 36];

const x = (margin: number) => PAD.left + (margin - RANGE[0]) / (RANGE[1] - RANGE[0]) * (VW - PAD.left - PAD.right);
const pdf = (value: number, mean: number) => Math.exp(-((value - mean) ** 2) / (2 * RACE_SD ** 2));
const normal = () => inverseNormal(Math.min(.9999, Math.max(.0001, Math.random())));

function bellPath(mean: number, top: number, height: number, side: "all" | "dem" | "rep") {
  const points: string[] = [];
  const from = side === "dem" ? Math.max(0, RANGE[0]) : RANGE[0];
  const to = side === "rep" ? Math.min(0, RANGE[1]) : RANGE[1];
  for (let step = 0; step <= 80; step += 1) {
    const value = from + (to - from) * step / 80;
    points.push(`${x(value).toFixed(1)},${(top + height - pdf(value, mean) * height).toFixed(1)}`);
  }
  if (side === "all") return `M ${points.join(" L ")}`;
  return `M ${x(from)},${top + height} L ${points.join(" L ")} L ${x(to)},${top + height} Z`;
}

type Draw = { national: number; locals: number[]; count: number };

// One national draw moves every race together; the local draw is each race's own luck.
export function StageErrorBells({ races }: { races: ExplainerRace[] }) {
  const [ref, inView] = useInView<HTMLDivElement>({ once: false });
  const [draw, setDraw] = useState<Draw | null>(null);

  const rows = races.slice(0, 3);
  const roll = () => setDraw((current) => ({ national: normal() * RACE_COMMON_SD, locals: rows.map(() => normal() * RACE_LOCAL_SD), count: (current?.count || 0) + 1 }));

  useEffect(() => {
    if (!inView || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const first = window.setTimeout(roll, 900);
    const interval = window.setInterval(roll, 2600);
    return () => { window.clearTimeout(first); window.clearInterval(interval); };
  // roll only depends on the row count, which is fixed once races load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, rows.length]);

  const shares = useMemo(() => ({ common: RACE_COMMON_SD ** 2 / RACE_SD ** 2, local: RACE_LOCAL_SD ** 2 / RACE_SD ** 2 }), []);
  const height = rows.length * ROW + 30;
  const shiftPx = draw ? x(draw.national) - x(0) : 0;

  return (
    <div className="stage-viz bells-viz" ref={ref} data-in={inView ? "true" : undefined}>
      <div className="viz-toolbar">
        <span>{draw ? <>Draw #{draw.count} · national error <b className={draw.national >= 0 ? "dem-text" : "rep-text"}>{signedLabel(draw.national)}</b> for every race</> : "Each race: expected margin ± 10 pts"}</span>
        <button type="button" className="viz-button" onClick={roll}>Draw an election</button>
      </div>
      <svg viewBox={`0 0 ${VW} ${height}`} className="viz-svg" role="img" aria-label="Error distributions for three races moving together with a shared national error">
        <line className="zero-line" x1={x(0)} x2={x(0)} y1="4" y2={height - 18} />
        <text className="axis-label" x={x(0)} y={height - 4} textAnchor="middle">EVEN</text>
        {rows.map((race, index) => {
          const top = 10 + index * ROW;
          const bellHeight = ROW - 26;
          const outcome = draw ? race.signedMargin + draw.national + draw.locals[index] : null;
          return (
            <g key={race.code + race.chamber} className="bell-row" style={{ "--i": index } as React.CSSProperties}>
              <text className="bell-label" x="0" y={top + bellHeight / 2}>{race.chamber === "senate" ? `${race.code} Senate` : race.code}</text>
              <text className="bell-sub" x="0" y={top + bellHeight / 2 + 16}>{signedLabel(race.signedMargin)} · {Math.round(demWinProbability(race.signedMargin) * 100)}% D</text>
              <g className="bell-shift" style={{ transform: `translateX(${shiftPx.toFixed(1)}px)` }}>
                <path className="bell-area rep" d={bellPath(race.signedMargin, top, bellHeight, "rep")} />
                <path className="bell-area dem" d={bellPath(race.signedMargin, top, bellHeight, "dem")} />
                <path className="bell-line" d={bellPath(race.signedMargin, top, bellHeight, "all")} pathLength={1} />
                <line className="bell-mean" x1={x(race.signedMargin)} x2={x(race.signedMargin)} y1={top + 4} y2={top + bellHeight} />
              </g>
              {outcome !== null && <circle key={draw!.count} className={`bell-outcome ${outcome >= 0 ? "dem" : "rep"}`} cx={x(Math.max(RANGE[0], Math.min(RANGE[1], outcome)))} cy={top + bellHeight - 6} r="5" />}
            </g>
          );
        })}
      </svg>
      <div className="error-budget">
        <div className="error-bar"><i className="common" style={{ flexGrow: shares.common }} /><i className="local" style={{ flexGrow: shares.local }} /></div>
        <div className="error-legend">
          <span><i className="common" />Shared national error ±{RACE_COMMON_SD.toFixed(2)} pts · {(shares.common * 100).toFixed(0)}% of variance</span>
          <span><i className="local" />Local error ±{RACE_LOCAL_SD.toFixed(2)} pts · {(shares.local * 100).toFixed(0)}%</span>
        </div>
        <p className="viz-note">The shared slice is small for any one race, but it hits all 470 at once. That common swing, not local luck, is what moves whole chambers.</p>
      </div>
    </div>
  );
}
