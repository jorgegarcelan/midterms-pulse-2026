"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dots from "@/data/map-dots.json";
import { useReducedMotion, useWidth } from "@/components/playground/hooks";
import { clamp, easeOutCubic, marginRgb } from "@/lib/playground/math";

type Props = {
  margins: Map<string, number>;
  flipped: Set<string>;
  label: string;
  onHover?: (code: string | null) => void;
  onSelect?: (code: string) => void;
  highlight?: string | null;
};

const CODES = dots.codes as string[];
// Grid cell → district index (−1 for empty cells), for hit-testing the pointer.
const OWNER = (() => {
  const rows = Math.floor(dots.height / dots.step);
  const owner = new Int16Array(rows * dots.cols).fill(-1);
  (dots.cells as number[][]).forEach((cells, index) => cells.forEach((cell) => { owner[cell] = index; }));
  return owner;
})();

/*
  The 435 districts as an even dot grid (rasterized Census boundaries), drawn on canvas. Colours glide
  to their new margin when the scenario changes; districts that flip against the forecast get a ring.
*/
export function DotMap({ margins, flipped, label, onHover, onSelect, highlight }: Props) {
  const [wrap, width] = useWidth<HTMLDivElement>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const shown = useRef<Float32Array | null>(null);
  const [hover, setHover] = useState<number>(-1);
  const pointer = useRef("mouse");
  const height = Math.round(width * dots.height / dots.width);
  const target = useMemo(() => Float32Array.from(CODES, (code) => margins.get(code) ?? 0), [margins]);
  const flips = useMemo(() => Uint8Array.from(CODES, (code) => flipped.has(code) ? 1 : 0), [flipped]);
  const active = highlight ? CODES.indexOf(highlight) : hover;

  useEffect(() => {
    const node = canvas.current;
    if (!node || !width) return;
    const ratio = window.devicePixelRatio || 1;
    node.width = Math.round(width * ratio);
    node.height = Math.round(height * ratio);
    const context = node.getContext("2d");
    if (!context) return;
    const scale = width / dots.width * ratio;
    const radius = dots.step * .36 * scale;
    const from = shown.current && shown.current.length === target.length ? Float32Array.from(shown.current) : Float32Array.from(target, () => 0);
    const current = new Float32Array(target.length);
    const cells = dots.cells as number[][];
    const draw = (progress: number) => {
      context.clearRect(0, 0, node.width, node.height);
      for (let index = 0; index < cells.length; index += 1) {
        const value = from[index] + (target[index] - from[index]) * progress;
        current[index] = value;
        const [r, g, b] = marginRgb(value, 18);
        const isActive = index === active;
        context.fillStyle = `rgb(${r},${g},${b})`;
        context.beginPath();
        const grow = isActive ? 1.35 : flips[index] ? 1.12 : 1;
        for (const cell of cells[index]) {
          const x = ((cell % dots.cols) * dots.step + dots.step / 2) * scale;
          const y = (Math.floor(cell / dots.cols) * dots.step + dots.step / 2) * scale;
          context.moveTo(x + radius * grow, y);
          context.arc(x, y, radius * grow, 0, Math.PI * 2);
        }
        context.fill();
        if (flips[index] || isActive) {
          context.strokeStyle = isActive ? "rgba(255,255,255,.95)" : "rgba(255,255,255,.55)";
          context.lineWidth = Math.max(.6, scale * .55);
          context.stroke();
        }
      }
      shown.current = current;
    };
    if (reduced || !shown.current || from.every((value, index) => Math.abs(value - target[index]) < .01)) { draw(1); return; }
    let frame = 0;
    let start = 0;
    const step = (now: number) => {
      if (!start) start = now;
      const progress = clamp((now - start) / 420, 0, 1);
      draw(easeOutCubic(progress));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, flips, width, height, reduced, active]);

  function locate(event: React.MouseEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * dots.width;
    const y = (event.clientY - rect.top) / rect.height * dots.height;
    const col = Math.floor(x / dots.step);
    const row = Math.floor(y / dots.step);
    // Nearest owned cell within one ring, so the gaps between dots still hit.
    for (const [dc, dr] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const c = col + dc, r = row + dr;
      if (c < 0 || c >= dots.cols || r < 0) continue;
      const owner = OWNER[r * dots.cols + c];
      if (owner >= 0) return owner;
    }
    return -1;
  }

  return <div className="pg-dotmap" ref={wrap} style={{ height: height || undefined }}>
    <canvas
      ref={canvas}
      role="img"
      aria-label={label}
      style={{ width, height }}
      onPointerMove={(event) => { const index = locate(event); if (index !== hover) { setHover(index); onHover?.(index >= 0 ? CODES[index] : null); } }}
      onPointerLeave={() => { setHover(-1); onHover?.(null); }}
      onPointerDown={(event) => { pointer.current = event.pointerType; }}
      onClick={(event) => {
        const index = locate(event);
        if (index < 0) return;
        // On touch screens the first tap shows the readout; a second tap on the same district opens it.
        if (pointer.current === "touch" && index !== hover) { setHover(index); onHover?.(CODES[index]); return; }
        onSelect?.(CODES[index]);
      }}
      className={hover >= 0 ? "pointing" : ""}
    />
  </div>;
}
