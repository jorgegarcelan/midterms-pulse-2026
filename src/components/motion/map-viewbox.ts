"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/components/motion/motion-utils";

export type ViewBox = [x: number, y: number, width: number, height: number];

const easeInOutCubic = (t: number) => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

// Fits a bounding box ([[x0, y0], [x1, y1]]) into a viewBox with the frame's aspect ratio and some padding.
export function fitViewBox(bounds: [[number, number], [number, number]], frame: [number, number], padding = .08, minSize = 60): ViewBox {
  const [[x0, y0], [x1, y1]] = bounds;
  const aspect = frame[0] / frame[1];
  let width = Math.max(minSize, (x1 - x0) * (1 + padding * 2));
  let height = Math.max(minSize / aspect, (y1 - y0) * (1 + padding * 2));
  if (width / height > aspect) height = width / aspect; else width = height * aspect;
  return [(x0 + x1) / 2 - width / 2, (y0 + y1) / 2 - height / 2, width, height];
}

// Animates an <svg>'s viewBox toward `target` imperatively (no React re-render per frame).
// Zooms travel along a log-scaled path so a big zoom-in feels like a camera move rather than a slide.
// The <svg> should render a constant viewBox prop; `onFrame` runs after every applied frame.
export function useViewBoxTween(target: ViewBox, { duration = 820, ready = true, onFrame }: { duration?: number; ready?: boolean; onFrame?: (box: ViewBox) => void } = {}) {
  const ref = useRef<SVGSVGElement>(null);
  const current = useRef<ViewBox | null>(null);
  const frameCallback = useRef(onFrame);
  useEffect(() => { frameCallback.current = onFrame; });
  const [tx, ty, tw, th] = target;

  useEffect(() => {
    const svg = ref.current;
    if (!svg || !ready) return;
    const to: ViewBox = [tx, ty, tw, th];
    const apply = (box: ViewBox) => {
      current.current = box;
      svg.setAttribute("viewBox", box.map((value) => value.toFixed(2)).join(" "));
      frameCallback.current?.(box);
    };
    const from = current.current;
    if (!from || prefersReducedMotion() || from.every((value, index) => Math.abs(value - to[index]) < .01)) {
      apply(to);
      return;
    }
    let frame = 0;
    let start = 0;
    const zoomFrom = Math.log(from[2]);
    const zoomTo = Math.log(to[2]);
    const step = (now: number) => {
      if (!start) start = now;
      const progress = Math.min(1, (now - start) / duration);
      const eased = easeInOutCubic(progress);
      const width = Math.exp(zoomFrom + (zoomTo - zoomFrom) * eased);
      const height = width * (to[3] / to[2]);
      const cx = from[0] + from[2] / 2 + (to[0] + to[2] / 2 - from[0] - from[2] / 2) * eased;
      const cy = from[1] + from[3] / 2 + (to[1] + to[3] / 2 - from[1] - from[3] / 2) * eased;
      apply([cx - width / 2, cy - height / 2, width, height]);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [tx, ty, tw, th, duration, ready]);

  return ref;
}
