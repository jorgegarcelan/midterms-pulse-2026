"use client";

import { useT } from "@/components/i18n/locale-provider";

type Node = { id: string; x: number; y: number; kicker: string; value: string; target: string; tone?: "dem" | "rep" | "live" };
const W = 190;
const H = 70;

function edgePath(from: Node, to: Node) {
  if (Math.abs(from.x - to.x) < 4) return `M ${from.x + W / 2} ${from.y + H} C ${from.x + W / 2} ${from.y + H + 40}, ${to.x + W / 2} ${to.y - 40}, ${to.x + W / 2} ${to.y}`;
  const x1 = from.x + W;
  const y1 = from.y + H / 2;
  const x2 = to.x;
  const y2 = to.y + H / 2;
  const bend = (x2 - x1) * .5;
  return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}

type PipelineHeroProps = { polls: string; races: string; ballot: string; movement: string; house: string; senate: string; onJump: (id: string) => void };

// The whole model on one line: data packets flow from the two sources to the two chamber outputs.
export function PipelineHero({ polls, races, ballot, movement, house, senate, onJump }: PipelineHeroProps) {
  const t = useT();
  const nodes: Node[] = [
    { id: "polls", x: 20, y: 60, kicker: t("Poll index"), value: polls, target: "inputs", tone: "live" },
    { id: "bench", x: 20, y: 250, kicker: t("Race forecasts"), value: races, target: "inputs", tone: "live" },
    { id: "weight", x: 275, y: 60, kicker: t("Weighted ballot"), value: ballot, target: "weights" },
    { id: "move", x: 530, y: 60, kicker: t("Movement"), value: movement, target: "movement" },
    { id: "races", x: 530, y: 250, kicker: t("Race odds"), value: "Φ(margin / 10)", target: "races" },
    { id: "sim", x: 785, y: 155, kicker: t("Monte Carlo"), value: t("50,000 runs"), target: "simulate" },
    { id: "house", x: 1030, y: 60, kicker: t("House"), value: house, target: "outputs", tone: "dem" },
    { id: "senate", x: 1030, y: 250, kicker: t("Senate"), value: senate, target: "outputs", tone: "dem" },
  ];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges: [string, string][] = [["polls", "weight"], ["weight", "move"], ["move", "races"], ["bench", "races"], ["races", "sim"], ["sim", "house"], ["sim", "senate"]];

  return (
    <div className="pipeline-hero">
      <svg viewBox="0 0 1240 350" role="img" aria-label={t("MP-26 pipeline: poll index and race forecasts flow through weighting, movement and race odds into 50,000 simulations that produce House and Senate control odds")}>
        <defs>
          <linearGradient id="pipe-stroke" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1240" y2="0"><stop offset="0" stopColor="#5b86ff" stopOpacity=".2" /><stop offset=".5" stopColor="#a78bfa" stopOpacity=".55" /><stop offset="1" stopColor="#ff5a6e" stopOpacity=".25" /></linearGradient>
        </defs>
        {edges.map(([from, to], index) => {
          const d = edgePath(byId.get(from)!, byId.get(to)!);
          return <g key={`${from}-${to}`} className="pipe-edge" style={{ "--i": index } as React.CSSProperties}>
            <path d={d} pathLength={1} />
            {[0, 1, 2].map((packet) => (
              <circle key={packet} r={packet === 0 ? 3.2 : 2.2} className={packet === 1 ? "pipe-packet alt" : "pipe-packet"} visibility="hidden">
                <set attributeName="visibility" to="visible" begin={`${1.3 + index * .18 + packet * .75}s`} />
                <animateMotion dur={`${2.2 + (index % 3) * .3}s`} begin={`${1.3 + index * .18 + packet * .75}s`} repeatCount="indefinite" path={d} />
              </circle>
            ))}
          </g>;
        })}
        {nodes.map((node, index) => (
          <g key={node.id} className={`pipe-node${node.tone ? ` ${node.tone}` : ""}`} style={{ "--i": index } as React.CSSProperties} transform={`translate(${node.x} ${node.y})`} role="link" tabIndex={0} aria-label={`${node.kicker}: ${node.value}`} onClick={() => onJump(node.target)} onKeyDown={(event) => { if (event.key === "Enter") onJump(node.target); }}>
            <rect width={W} height={H} rx="14" />
            <circle className="pipe-node-dot" cx="18" cy="22" r="3.5" />
            <text className="pipe-kicker" x="30" y="26">{node.kicker.toUpperCase()}</text>
            <text className="pipe-value" x="16" y="53">{node.value}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
