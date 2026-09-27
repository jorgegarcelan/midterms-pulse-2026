"use client";

import { useMemo, useState } from "react";
import { CountUp } from "@/components/motion/count-up";
import { seeded } from "@/components/motion/motion-utils";
import { parliamentLayout } from "@/lib/parliament";

const RADIUS = 200;

// Adds a deterministic "burst" origin to each seat so the chamber can assemble on reveal.
function layout(total: number, rows: number, inner: number) {
  const { seats, dot } = parliamentLayout(total, rows, inner);
  const random = seeded(total * 7919);
  return {
    dot: dot * RADIUS,
    seats: seats.map((seat) => {
      const burst = 140 + random() * 260;
      const heading = random() * Math.PI * 2;
      return { x: seat.x * RADIUS, y: seat.y * RADIUS, dx: Math.cos(heading) * burst, dy: Math.sin(heading) * burst - 60 };
    }),
  };
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
