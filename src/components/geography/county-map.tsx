"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoAlbersUsa } from "d3-geo";
import { prefersReducedMotion } from "@/components/motion/motion-utils";
import { margin, type County, type Year } from "@/lib/geography";

export const MAP = { width: 960, height: 600 };
export type RGBA = [number, number, number, number];
export type SizeMode = "votes" | "equal";

const BLUE: RGBA = [77, 127, 225, 1];
const RED: RGBA = [224, 82, 93, 1];
const NEUTRAL: RGBA = [214, 207, 196, 1];
const mix = (a: RGBA, b: RGBA, t: number): RGBA => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];

// Diverging colour for a D − R margin: saturates at ±40 points.
export function marginColor(value: number, alpha = 1): RGBA {
  const t = Math.min(1, Math.abs(value) / 40) ** .7;
  const color = mix(NEUTRAL, value >= 0 ? BLUE : RED, .25 + .75 * t);
  return [color[0], color[1], color[2], alpha];
}

export type Projected = County & { x: number; y: number };

export function useProjected(counties: County[]) {
  return useMemo(() => {
    const projection = geoAlbersUsa().scale(1260).translate([MAP.width / 2, MAP.height / 2]);
    return counties.flatMap((county) => {
      const point = projection([county.lon, county.lat]);
      return point ? [{ ...county, x: point[0], y: point[1] }] : [];
    });
  }, [counties]);
}

type Props = {
  counties: Projected[];
  colorOf: (county: Projected) => RGBA;
  size: SizeMode;
  highlight?: ((county: Projected) => boolean) | null;
  arrows?: { from: Year; to: Year } | null;
  label: string;
  onHover?: (county: Projected | null) => void;
};

/*
  Every county as a dot on a canvas, sized by its vote or equally. Colour, size and highlight changes
  tween over ~600 ms so each chapter of the story morphs into the next; `arrows` draws the swing
  between two elections as a leftward (D) or rightward (R) stroke from each county.
*/
export function CountyMap({ counties, colorOf, size, highlight, arrows, label, onHover }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef<{ colors: RGBA[]; radii: number[]; arrow: number } | null>(null);
  const [hovered, setHovered] = useState<Projected | null>(null);

  const maxVotes = useMemo(() => Math.max(1, ...counties.map((county) => county.v24[2])), [counties]);
  const target = useMemo(() => counties.map((county) => {
    const color = colorOf(county);
    const dim = highlight && !highlight(county);
    return { color: dim ? [color[0], color[1], color[2], .09] as RGBA : color, radius: size === "votes" ? 1.1 + Math.sqrt(county.v24[2] / maxVotes) * 15 : 2.1 };
  }), [counties, colorOf, highlight, maxVotes, size]);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ratio = window.devicePixelRatio || 1;
    element.width = MAP.width * ratio;
    element.height = MAP.height * ratio;
    const context = element.getContext("2d")!;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const from = state.current ?? { colors: target.map((item) => [item.color[0], item.color[1], item.color[2], 0] as RGBA), radii: target.map(() => 0), arrow: 0 };
    const arrowTarget = arrows ? 1 : 0;
    const duration = prefersReducedMotion() ? 0 : 650;
    let frame = 0;
    const start = performance.now();

    const draw = (now: number) => {
      const t = duration ? Math.min(1, (now - start) / duration) : 1;
      const ease = 1 - (1 - t) ** 3;
      const colors = target.map((item, index) => mix(from.colors[index] ?? item.color, item.color, ease));
      const radii = target.map((item, index) => (from.radii[index] ?? item.radius) + (item.radius - (from.radii[index] ?? item.radius)) * ease);
      const arrow = from.arrow + (arrowTarget - from.arrow) * ease;
      context.clearRect(0, 0, MAP.width, MAP.height);
      // Large dots first so small rural counties stay visible on top.
      const order = radii.map((radius, index) => [radius, index] as const).sort((a, b) => b[0] - a[0]);
      for (const [radius, index] of order) {
        const county = counties[index];
        const [r, g, b, a] = colors[index];
        if (arrows && arrow > 0) {
          const shift = margin(county[arrows.to]) - margin(county[arrows.from]);
          const length = Math.max(-46, Math.min(46, -shift * 2.6)) * arrow;
          context.strokeStyle = `rgba(${shift >= 0 ? "130,170,250" : "240,112,120"},${Math.min(.95, .55 + Math.sqrt(county.v24[2] / maxVotes) * 1.5) * (a > .2 ? 1 : .2)})`;
          context.lineWidth = 1 + Math.sqrt(county.v24[2] / maxVotes) * 3.2;
          context.beginPath();
          context.moveTo(county.x, county.y);
          context.lineTo(county.x + length, county.y - Math.abs(length) * .55);
          context.stroke();
          if ((1 - arrow) * radius < .3) continue;
        }
        context.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${a * (arrows ? 1 - arrow * .85 : 1)})`;
        context.beginPath();
        context.arc(county.x, county.y, Math.max(.4, radius * (arrows ? 1 - arrow * .6 : 1)), 0, Math.PI * 2);
        context.fill();
      }
      state.current = { colors, radii, arrow };
      if (t < 1) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [arrows, counties, maxVotes, target]);

  function pick(event: React.PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width * MAP.width;
    const y = (event.clientY - bounds.top) / bounds.height * MAP.height;
    let best: Projected | null = null;
    let distance = 14 ** 2;
    counties.forEach((county, index) => {
      const d = (county.x - x) ** 2 + (county.y - y) ** 2;
      const reach = Math.max(14, target[index].radius + 3) ** 2;
      if (d < Math.min(distance, reach)) { distance = d; best = county; }
    });
    setHovered(best);
    onHover?.(best);
  }

  return <div className="county-map">
    <canvas ref={canvas} role="img" aria-label={label} style={{ aspectRatio: `${MAP.width} / ${MAP.height}` }} onPointerMove={pick} onPointerLeave={() => { setHovered(null); onHover?.(null); }} />
    {hovered && <span className="county-map-ring" style={{ left: `${hovered.x / MAP.width * 100}%`, top: `${hovered.y / MAP.height * 100}%` }} />}
  </div>;
}
