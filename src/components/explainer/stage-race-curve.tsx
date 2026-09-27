"use client";

import { useEffect, useMemo, useState } from "react";
import { demWinProbability, RACE_SD } from "@/lib/mp26";
import { signedLabel, useInView } from "@/components/explainer/use-in-view";

export type ExplainerRace = { code: string; chamber: "house" | "senate"; signedMargin: number; winProbability: number; leader: "D" | "R"; rating?: string; incumbentParty?: "D" | "R" | null };

const VW = 640;
const VH = 340;
const PAD = { left: 40, right: 16, top: 20, bottom: 40 };
const LIMIT = 40;
const DOT = 2.3;

// 470 margins drop into a swarm, then each rides up the curve to its win probability.
export function StageRaceCurve({ races, tippingCode }: { races: ExplainerRace[]; tippingCode?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const [phase, setPhase] = useState<"margin" | "probability">("margin");

  useEffect(() => {
    if (!inView) return;
    const timer = window.setTimeout(() => setPhase("probability"), 2200);
    return () => window.clearTimeout(timer);
  }, [inView]);

  const layout = useMemo(() => {
    const plotW = VW - PAD.left - PAD.right;
    const plotH = VH - PAD.top - PAD.bottom;
    const x = (margin: number) => PAD.left + (Math.max(-LIMIT, Math.min(LIMIT, margin)) + LIMIT) / (2 * LIMIT) * plotW;
    const yProbability = (p: number) => PAD.top + (1 - p) * plotH;
    const baseline = VH - PAD.bottom;
    const stacks = new Map<number, number>();
    const dots = [...races].sort((a, b) => a.signedMargin - b.signedMargin).map((race, index) => {
      const cx = x(race.signedMargin);
      const bin = Math.round(cx / (DOT * 2.2));
      const level = stacks.get(bin) || 0;
      stacks.set(bin, level + 1);
      const swarmY = baseline - DOT - 1 - level * DOT * 2.1;
      const curveY = yProbability(demWinProbability(race.signedMargin));
      return { race, index, cx, swarmY, curveY };
    });
    const curve = Array.from({ length: 121 }, (_, index) => {
      const margin = -LIMIT + index * (2 * LIMIT) / 120;
      return `${x(margin).toFixed(1)},${yProbability(demWinProbability(margin)).toFixed(1)}`;
    }).join(" L ");
    return { x, yProbability, dots, curve, baseline };
  }, [races]);

  const { x, yProbability, dots, curve, baseline } = layout;
  const tipping = dots.find((dot) => dot.race.code === tippingCode && dot.race.chamber === "house");

  return (
    <div className="stage-viz" ref={ref} data-in={inView ? "true" : undefined} data-phase={phase}>
      <div className="viz-toolbar">
        <span>{races.length} races · {races.filter((race) => race.chamber === "house").length} House + {races.filter((race) => race.chamber === "senate").length} Senate</span>
        <div className="segmented" role="group" aria-label="View">
          <button type="button" className={phase === "margin" ? "selected" : ""} onClick={() => setPhase("margin")}>Margins</button>
          <button type="button" className={phase === "probability" ? "selected" : ""} onClick={() => setPhase("probability")}>Win odds</button>
        </div>
      </div>
      <svg viewBox={`0 0 ${VW} ${VH}`} className="viz-svg race-curve" role="img" aria-label="Race margins mapped to Democratic win probability">
        {[0, .5, 1].map((p) => <g key={p} className="viz-grid prob-grid"><line x1={PAD.left} x2={VW - PAD.right} y1={yProbability(p)} y2={yProbability(p)} /><text x={PAD.left - 6} y={yProbability(p) + 4}>{Math.round(p * 100)}%</text></g>)}
        <line className="zero-line" x1={x(0)} x2={x(0)} y1={PAD.top} y2={baseline} />
        <path className="prob-curve" d={`M ${curve}`} pathLength={1} />
        {dots.map((dot) => (
          <circle
            key={`${dot.race.chamber}-${dot.race.code}`}
            className={`race-dot ${dot.race.signedMargin >= 0 ? "dem" : "rep"}${dot.race.chamber === "senate" ? " senate" : ""}`}
            cx={dot.cx.toFixed(1)}
            cy="0"
            r={DOT}
            style={{ "--swarm": `${dot.swarmY.toFixed(1)}px`, "--curve": `${dot.curveY.toFixed(1)}px`, "--i": dot.index } as React.CSSProperties}
          >
            <title>{`${dot.race.chamber === "senate" ? `${dot.race.code} Senate` : dot.race.code} · ${signedLabel(dot.race.signedMargin)} · ${dot.race.winProbability}% ${dot.race.leader}`}</title>
          </circle>
        ))}
        {tipping && <g className="tipping-mark" style={{ "--swarm": `${tipping.swarmY.toFixed(1)}px`, "--curve": `${tipping.curveY.toFixed(1)}px` } as React.CSSProperties}>
          <circle cx={tipping.cx} cy="0" r="8" />
          <text x={tipping.cx + 12} y="0" dy="-8">{tipping.race.code} · 218th seat</text>
        </g>}
        <g className="axis-label">
          <text x={PAD.left} y={VH - 12}>R+{LIMIT}</text>
          <text x={x(0)} y={VH - 12} textAnchor="middle">EVEN</text>
          <text x={VW - PAD.right} y={VH - 12} textAnchor="end">D+{LIMIT}</text>
        </g>
      </svg>
      <div className="viz-foot">
        <span className="formula">P(D) = Φ(margin / {RACE_SD})</span>
        <span>A D+5 race is <b>{Math.round(demWinProbability(5) * 100)}%</b>; a D+10 race <b>{Math.round(demWinProbability(10) * 100)}%</b>; a coin flip needs a margin of 0.</span>
      </div>
    </div>
  );
}
