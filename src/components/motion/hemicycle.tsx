"use client";

import "@/app/motion-b.css";
import { useMemo, useState } from "react";
import { CountUp } from "@/components/motion/count-up";
import { seeded } from "@/components/motion/motion-utils";
import { parliamentLayout } from "@/lib/parliament";
import { useT } from "@/components/i18n/locale-provider";

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
  const t = useT();
  const { seats, dot } = useMemo(() => layout(total, rows, inner), [inner, rows, total]);
  // The ripple starts at the previous majority boundary, so remember where it was.
  const [boundary, setBoundary] = useState({ current: dem, origin: dem });
  if (boundary.current !== dem) setBoundary({ current: dem, origin: boundary.current });
  const origin = boundary.origin;
  const rep = total - dem;
  const demControl = dem >= majority;
  // Pointing at a seat lifts its party's bloc and dims the other side.
  const [bloc, setBloc] = useState<"d" | "r" | null>(null);

  return (
    <article className="hemi-card">
      <div className="hemi-card-head"><span>{label}</span><span><b>{majority}</b> {t("for majority")}</span></div>
      <svg className={`hemi${bloc ? ` focus-${bloc}` : ""}`} onPointerMove={(event) => { const target = event.target as Element; setBloc(target instanceof SVGCircleElement ? (target.classList.contains("d") ? "d" : "r") : null); }} onPointerLeave={() => setBloc(null)} viewBox={`${-RADIUS - 12} ${-RADIUS - 28} ${RADIUS * 2 + 24} ${RADIUS + 36}`} role="img" aria-label={t("{label}: {dem} Democratic seats, {rep} Republican seats", { label, dem, rep })}>
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
      <div className={`hemi-score${bloc ? ` focus-${bloc}` : ""}`}>
        <div><strong className="dem-text"><CountUp value={dem} delay={500} /></strong> <span>{t("Dem")}</span></div>
        <div className={`hemi-verdict ${demControl ? "d" : "r"}`}>{demControl ? t("Democratic control") : t("Republican control")}</div>
        <div><span>{t("Rep")}</span> <strong className="rep-text"><CountUp value={rep} delay={500} /></strong></div>
      </div>
    </article>
  );
}
