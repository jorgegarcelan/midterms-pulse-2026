"use client";

import { useEffect, useRef, useState } from "react";
import { easeOutQuart, prefersReducedMotion } from "@/components/motion/motion-utils";

// Glides a list of numbers to new targets (paths morph instead of jumping when data refreshes).
// Lengths that change snap straight to the new values, and reduced motion always snaps.
export function useTweenedValues(target: readonly number[], duration = 700): readonly number[] {
  const key = target.join(",");
  const [shown, setShown] = useState<readonly number[]>(target);
  const current = useRef<readonly number[]>(target);

  useEffect(() => {
    const next = key ? key.split(",").map(Number) : [];
    const from = current.current;
    let frame = 0;
    if (prefersReducedMotion() || from.length !== next.length || from.every((value, index) => value === next[index])) {
      current.current = next;
      frame = requestAnimationFrame(() => setShown(next));
      return () => cancelAnimationFrame(frame);
    }
    let start = 0;
    const step = (now: number) => {
      if (!start) start = now;
      const progress = Math.min(1, (now - start) / duration);
      const eased = easeOutQuart(progress);
      const value = next.map((end, index) => from[index] + (end - from[index]) * eased);
      current.current = value;
      setShown(value);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [key, duration]);

  return shown.length === target.length ? shown : target;
}
