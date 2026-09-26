"use client";

import { useMemo, useState } from "react";
import { CountUp } from "@/components/motion/count-up";
import { seeded } from "@/components/motion/motion-utils";

type Seat = { x: number; y: number; dx: number; dy: number };
const RADIUS = 200;

// Parliament layout: concentric rows, seats per row proportional to radius, ordered left → right by angle.
function layout(total: number, rows: number, inner: number) {
  const radii = Array.from({ length: rows }, (_, index) => inner + (1 - inner) * (index / (rows - 1)));
  const sum = radii.reduce((acc, radius) => acc + radius, 0);
  const counts = radii.map((radius) => Math.round(total * radius / sum));
  counts[rows - 1] += total - counts.reduce((acc, count) => acc + count, 0);
  const random = seeded(total * 7919);
  const seats: (Seat & { angle: number; ring: number })[] = [];
  radii.forEach((radius, ring) => {
    const count = counts[ring];
    for (let index = 0; index < count; index += 1) {
      const angle = count === 1 ? Math.PI / 2 : Math.PI * index / (count - 1);
      const burst = 140 + random() * 260;
      const heading = random() * Math.PI * 2;
      seats.push({
        x: -Math.cos(angle) * radius * RADIUS, y: -Math.sin(angle) * radius * RADIUS, angle, ring,
        dx: Math.cos(heading) * burst, dy: Math.sin(heading) * burst - 60,
      });
    }
  });
  const dot = Math.min((1 - inner) / (rows - 1), Math.PI * (radii.at(-1) || 1) / (counts.at(-1)! - 1)) * RADIUS * 0.4;
  return { seats: seats.sort((a, b) => a.angle - b.angle || b.ring - a.ring), dot };
}

type HemicycleProps = { label: string; total: number; dem: number; majority: number; rows: number; inner?: number; majorityNote?: string };

export function Hemicycle({ label, total, dem, majority, rows, inner = .38, majorityNote }: HemicycleProps) {
  const { seats, dot } = useMemo(() => layout(total, rows, inner), [inner, rows, total]);
  // The ripple starts at the previous majority boundary, so remember where it was.
  const [boundary, setBoundary] = useState({ current: dem, origin: dem });
  if (boundary.current !== dem) setBoundary({ current: dem, origin: boundary.current });
  const origin = boundary.origin;
  const rep = total - dem;
  const demControl = dem >= majority;

  return (
    <article className="hemi-card">
      <div className="hemi-card-head"><span>{label}</span><span><b>{majority}</b> for majority</span></div>
      <svg className="hemi" viewBox={`${-RADIUS - 12} ${-RADIUS - 28} ${RADIUS * 2 + 24} ${RADIUS + 36}`} role="img" aria-label={`${label}: ${dem} Democratic seats, ${rep} Republican seats`}>
        <line className="hemi-majority" x1="0" y1="4" x2="0" y2={-RADIUS - 8} />
        <text className="hemi-majority-label" x="0" y={-RADIUS - 14}>{majority}{majorityNote ? ` · ${majorityNote}` : ""}</text>
        {seats.map((seat, index) => (
          <circle
            key={index}
            cx={seat.x.toFixed(2)}
            cy={seat.y.toFixed(2)}
            r={dot.toFixed(2)}
            className={index < dem ? "d" : "r"}
            style={{ "--i": index, "--dx": `${seat.dx.toFixed(1)}px`, "--dy": `${seat.dy.toFixed(1)}px`, "--rd": `${Math.min(900, Math.abs(index - origin) * 9)}ms` } as React.CSSProperties}
          />
        ))}
      </svg>
      <div className="hemi-score">
        <div><strong className="dem-text"><CountUp value={dem} delay={500} /></strong> <span>Dem</span></div>
        <div className={`hemi-verdict ${demControl ? "d" : "r"}`}>{demControl ? "Democratic control" : "Republican control"}</div>
        <div><span>Rep</span> <strong className="rep-text"><CountUp value={rep} delay={500} /></strong></div>
      </div>
    </article>
  );
}
